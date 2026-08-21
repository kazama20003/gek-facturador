import { InvoiceNotFoundError } from '../../domain/errors/invoice-errors';
import type { InvoicePdfGenerator } from '../ports/invoice-pdf-generator.port';
import type { InvoiceRepository } from '../ports/invoice-repository.port';
import type { InvoiceXmlGenerator } from '../ports/invoice-xml-generator.port';
import type { InvoiceXmlSigner } from '../ports/invoice-xml-signer.port';

export interface GeneratePdfResult {
  readonly buffer: Buffer;
  /** e.g. "F001-00000001.pdf" — the SUNAT series-correlative naming. */
  readonly fileName: string;
}

/**
 * Produces the printed representation (PDF) of a persisted invoice.
 *
 * The QR needs the XML-DSig signature digest. If the invoice was already
 * submitted, the stored signed XML is reused; otherwise the aggregate is
 * re-rendered and re-signed on the fly (the DigestValue is deterministic for
 * the same content). No XSD validation nor SUNAT submission happens.
 */
export class GeneratePdfUseCase {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly generator: InvoiceXmlGenerator,
    private readonly signer: InvoiceXmlSigner,
    private readonly pdf: InvoicePdfGenerator,
  ) {}

  async execute(id: string): Promise<GeneratePdfResult> {
    const stored = await this.invoices.findById(id);
    if (!stored) {
      throw new InvoiceNotFoundError(id);
    }
    const { invoice } = stored;
    const signedXml =
      stored.signedXml ?? this.signer.sign(this.generator.generate(invoice));
    const buffer = await this.pdf.generate(invoice, signedXml);
    const correlative = String(invoice.correlative.toNumber()).padStart(8, '0');
    const fileName = `${invoice.series.toString()}-${correlative}.pdf`;
    return { buffer, fileName };
  }
}
