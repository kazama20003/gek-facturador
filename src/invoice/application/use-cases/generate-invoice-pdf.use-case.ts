import { InvoiceNotFoundError } from '../../domain/errors/invoice-errors';
import type { InvoicePdfGenerator } from '../ports/invoice-pdf-generator.port';
import type { InvoiceRepository } from '../ports/invoice-repository.port';
import type { InvoiceXmlGenerator } from '../ports/invoice-xml-generator.port';
import type { InvoiceXmlSigner } from '../ports/invoice-xml-signer.port';

/**
 * Produces the printed representation (PDF) of a persisted invoice.
 *
 * The QR needs the XML-DSig signature digest, so the stored aggregate is
 * re-rendered and re-signed here (the DigestValue is deterministic for the
 * same content). No XSD validation nor SUNAT submission happens.
 */
export class GeneratePdfUseCase {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly generator: InvoiceXmlGenerator,
    private readonly signer: InvoiceXmlSigner,
    private readonly pdf: InvoicePdfGenerator,
  ) {}

  async execute(id: string): Promise<Buffer> {
    const stored = await this.invoices.findById(id);
    if (!stored) {
      throw new InvoiceNotFoundError(id);
    }
    const signedXml = this.signer.sign(this.generator.generate(stored.invoice));
    return this.pdf.generate(stored.invoice, signedXml);
  }
}
