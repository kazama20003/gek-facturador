import { InvoiceNotFoundError } from '../../domain/errors/invoice-errors';
import { DomainError } from '../../../shared/domain/domain-error';
import type { InvoicePackager } from '../ports/invoice-packager.port';
import type {
  InvoiceRepository,
  StoredInvoice,
} from '../ports/invoice-repository.port';
import type { InvoiceXmlSigner } from '../ports/invoice-xml-signer.port';
import type { CdrResult } from '../ports/sunat-bill-sender.port';
import type { SubmissionRepository } from '../ports/submission-repository.port';
import type { SunatSummarySender } from '../ports/sunat-summary-sender.port';
import type { VoidedDocumentsInput } from '../../infrastructure/xml/ubl-voided-xml-generator';

export class InvoiceNotVoidableError extends DomainError {}

/** Port shape for the voided-documents XML generator. */
export interface VoidedXmlGenerator {
  generate(input: VoidedDocumentsInput): string;
}

export const VOIDED_XML_GENERATOR = Symbol('VoidedXmlGenerator');

export interface VoidInvoicesCommand {
  /** Sequential number of communications sent for the reference date. */
  voidCorrelative: number;
  documents: Array<{ invoiceId: string; reason: string }>;
}

export interface VoidInvoicesResult {
  readonly voidedId: string;
  readonly fileName: string;
  readonly documents: ReadonlyArray<string>;
  readonly ticket: string;
  readonly statusCode: string;
  readonly cdr?: CdrResult;
}

const POLL_ATTEMPTS = 10;
const POLL_DELAY_MS = 2_000;

/**
 * Comunicación de Baja (RA): voids ACCEPTED invoices/notes referenced by id.
 * Builds and signs the VoidedDocuments XML, submits via sendSummary, polls
 * the ticket and marks each document VOIDED when SUNAT accepts.
 * Boletas cannot be voided here — SUNAT voids them through the daily summary.
 */
export class VoidInvoicesUseCase {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly generator: VoidedXmlGenerator,
    private readonly signer: InvoiceXmlSigner,
    private readonly packager: InvoicePackager,
    private readonly sender: SunatSummarySender,
    private readonly submissions?: SubmissionRepository,
    private readonly today: () => string = () =>
      new Date().toISOString().slice(0, 10),
    private readonly delay: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  async execute(command: VoidInvoicesCommand): Promise<VoidInvoicesResult> {
    if (command.documents.length === 0) {
      throw new InvoiceNotVoidableError('At least one document is required.');
    }

    const stored: Array<{ entry: StoredInvoice; reason: string }> = [];
    for (const doc of command.documents) {
      const entry = await this.invoices.findById(doc.invoiceId);
      if (!entry) {
        throw new InvoiceNotFoundError(doc.invoiceId);
      }
      if (entry.invoice.documentType === '03') {
        throw new InvoiceNotVoidableError(
          'Boletas are voided through the daily summary (ConditionCode 3), not the RA communication.',
        );
      }
      if (entry.status !== 'ACCEPTED') {
        throw new InvoiceNotVoidableError(
          `Document ${doc.invoiceId} is ${entry.status}; only ACCEPTED documents can be voided.`,
        );
      }
      stored.push({ entry, reason: doc.reason });
    }

    const referenceDate = stored[0].entry.invoice.issueDate
      .toISOString()
      .slice(0, 10);
    const sameDay = stored.every(
      (s) =>
        s.entry.invoice.issueDate.toISOString().slice(0, 10) === referenceDate,
    );
    if (!sameDay) {
      throw new InvoiceNotVoidableError(
        'All documents in one RA communication must share the same issue date.',
      );
    }

    const issuer = stored[0].entry.invoice.issuer;
    const voidedId = `RA-${referenceDate.replaceAll('-', '')}-${command.voidCorrelative}`;
    const baseFileName = `${issuer.ruc.toString()}-${voidedId}`;

    const signedXml = this.signer.sign(
      this.generator.generate({
        issuer: {
          ruc: issuer.ruc.toString(),
          businessName: issuer.businessName,
        },
        referenceDate,
        issueDate: this.today(),
        correlative: command.voidCorrelative,
        lines: stored.map((s) => ({
          documentType: s.entry.invoice.documentType,
          series: s.entry.invoice.series.toString(),
          correlative: s.entry.invoice.correlative.toNumber(),
          reason: s.reason,
        })),
      }),
    );
    const zip = await this.packager.package(baseFileName, signedXml);
    const { ticket } = await this.sender.sendSummary(
      `${baseFileName}.zip`,
      zip,
    );

    let statusCode = '98';
    let cdr: CdrResult | undefined;
    let cdrZipBase64: string | undefined;
    for (
      let attempt = 0;
      attempt < POLL_ATTEMPTS && statusCode === '98';
      attempt++
    ) {
      if (attempt > 0) await this.delay(POLL_DELAY_MS);
      const status = await this.sender.getStatus(ticket);
      statusCode = status.statusCode;
      cdr = status.cdr;
      cdrZipBase64 = status.cdrZipBase64;
    }

    if (cdr?.accepted) {
      for (const s of stored) {
        await this.invoices.markVoided(s.entry.invoice.id, {
          fileName: `${baseFileName}.zip`,
          cdr,
          cdrZipBase64: cdrZipBase64 ?? '',
          signedXml,
        });
      }
    }

    await this.submissions?.record({
      kind: 'RA',
      documentId: voidedId,
      fileName: `${baseFileName}.zip`,
      ticket,
      statusCode,
      cdr,
      cdrZipBase64,
      signedXml,
    });

    return {
      voidedId,
      fileName: `${baseFileName}.zip`,
      documents: stored.map(
        (s) =>
          `${s.entry.invoice.series.toString()}-${s.entry.invoice.correlative.toNumber()}`,
      ),
      ticket,
      statusCode,
      cdr,
    };
  }
}
