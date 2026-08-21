import { Invoice } from '../../domain/aggregates/invoice';
import { InvoiceNotFoundError } from '../../domain/errors/invoice-errors';
import type { InvoicePackager } from '../ports/invoice-packager.port';
import type { InvoiceRepository } from '../ports/invoice-repository.port';
import type { InvoiceXmlSigner } from '../ports/invoice-xml-signer.port';
import type { CdrResult } from '../ports/sunat-bill-sender.port';
import type { SubmissionRepository } from '../ports/submission-repository.port';
import type { SunatSummarySender } from '../ports/sunat-summary-sender.port';

/** Port shape for the summary XML generator (implemented by UblSummaryXmlGenerator). */
export interface SummaryXmlGenerator {
  generate(input: {
    referenceDate: string;
    issueDate: string;
    correlative: number;
    lines: ReadonlyArray<{ boleta: Invoice; conditionCode: '1' | '3' }>;
  }): string;
}

export const SUMMARY_XML_GENERATOR = Symbol('SummaryXmlGenerator');

export interface SendDailySummaryCommand {
  issuerRuc: string;
  /** Issue date of the boletas being summarized (YYYY-MM-DD). */
  referenceDate: string;
  /** Sequential number of summaries sent for that date (1, 2, ...). */
  summaryCorrelative: number;
  /**
   * When provided, the summary VOIDS these boletas (ConditionCode 3) instead
   * of reporting the whole day. Only ACCEPTED boletas of referenceDate.
   */
  voidBoletaIds?: string[];
}

export interface SendDailySummaryResult {
  readonly summaryId: string;
  readonly fileName: string;
  readonly boletas: ReadonlyArray<string>;
  readonly ticket: string;
  readonly statusCode: string;
  readonly cdr?: CdrResult;
}

const POLL_ATTEMPTS = 10;
const POLL_DELAY_MS = 2_000;

/**
 * Daily boleta summary (Resumen Diario): loads the day's persisted boletas,
 * builds and signs the RC document, submits it via sendSummary and polls
 * getStatus until SUNAT resolves the ticket. On acceptance, every summarized
 * boleta is marked ACCEPTED with the summary's CDR.
 */
export class SendDailySummaryUseCase {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly generator: SummaryXmlGenerator,
    private readonly signer: InvoiceXmlSigner,
    private readonly packager: InvoicePackager,
    private readonly sender: SunatSummarySender,
    private readonly submissions?: SubmissionRepository,
    private readonly delay: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  async execute(
    command: SendDailySummaryCommand,
  ): Promise<SendDailySummaryResult> {
    const voiding = (command.voidBoletaIds?.length ?? 0) > 0;

    let stored = await this.invoices.findBoletasByIssueDate(
      command.issuerRuc,
      command.referenceDate,
    );
    if (voiding) {
      const wanted = new Set(command.voidBoletaIds);
      stored = stored.filter((s) => wanted.has(s.invoice.id));
      if (stored.length !== wanted.size) {
        throw new InvoiceNotFoundError(
          `some boletas to void were not found among ${command.referenceDate} boletas of ${command.issuerRuc}`,
        );
      }
      const notAccepted = stored.find((s) => s.status !== 'ACCEPTED');
      if (notAccepted) {
        throw new InvoiceNotFoundError(
          `boleta ${notAccepted.invoice.id} is ${notAccepted.status}; only ACCEPTED boletas can be voided`,
        );
      }
    }
    if (stored.length === 0) {
      throw new InvoiceNotFoundError(
        `no boletas issued on ${command.referenceDate} for ${command.issuerRuc}`,
      );
    }

    const conditionCode: '1' | '3' = voiding ? '3' : '1';
    const boletas = stored.map((s) => s.invoice);
    const summaryId = `RC-${command.referenceDate.replaceAll('-', '')}-${command.summaryCorrelative}`;
    const baseFileName = `${command.issuerRuc}-${summaryId}`;
    const issueDate = boletas[0].issueDate.toISOString().slice(0, 10);

    const signedXml = this.signer.sign(
      this.generator.generate({
        referenceDate: command.referenceDate,
        issueDate,
        correlative: command.summaryCorrelative,
        lines: boletas.map((boleta) => ({ boleta, conditionCode })),
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

    if (cdr) {
      for (const entry of stored) {
        const outcome = {
          fileName: `${baseFileName}.zip`,
          cdr,
          cdrZipBase64: cdrZipBase64 ?? '',
          signedXml,
        };
        if (voiding) {
          await this.invoices.markVoided(entry.invoice.id, outcome);
        } else {
          await this.invoices.recordSunatOutcome(entry.invoice.id, outcome);
        }
      }
    }

    await this.submissions?.record({
      kind: 'RC',
      documentId: summaryId,
      fileName: `${baseFileName}.zip`,
      ticket,
      statusCode,
      cdr,
      cdrZipBase64,
      signedXml,
    });

    return {
      summaryId,
      fileName: `${baseFileName}.zip`,
      boletas: boletas.map(
        (b) => `${b.series.toString()}-${b.correlative.toNumber()}`,
      ),
      ticket,
      statusCode,
      cdr,
    };
  }
}
