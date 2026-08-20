import { Invoice } from '../../domain/aggregates/invoice';
import type { InvoicePackager } from '../ports/invoice-packager.port';
import type { InvoiceXmlGenerator } from '../ports/invoice-xml-generator.port';
import type { InvoiceXmlSigner } from '../ports/invoice-xml-signer.port';
import type {
  CdrResult,
  SunatBillSender,
} from '../ports/sunat-bill-sender.port';

export interface SendInvoiceToSunatResult {
  readonly fileName: string;
  readonly cdr: CdrResult;
  readonly cdrZipBase64: string;
  readonly signedXml: string;
}

/**
 * Full submission pipeline: generate UBL XML → sign → ZIP
 * (RUC-01-SERIE-CORRELATIVO) → sendBill → parse CDR.
 */
export class SendInvoiceToSunatUseCase {
  constructor(
    private readonly generator: InvoiceXmlGenerator,
    private readonly signer: InvoiceXmlSigner,
    private readonly packager: InvoicePackager,
    private readonly sender: SunatBillSender,
  ) {}

  async execute(invoice: Invoice): Promise<SendInvoiceToSunatResult> {
    invoice.issue();

    const baseFileName = [
      invoice.issuer.ruc.toString(),
      invoice.documentType,
      invoice.series.toString(),
      invoice.correlative.toNumber(),
    ].join('-');

    const signedXml = this.signer.sign(this.generator.generate(invoice));
    const zip = await this.packager.package(baseFileName, signedXml);
    const { cdr, cdrZipBase64 } = await this.sender.send(
      `${baseFileName}.zip`,
      zip,
    );

    return { fileName: `${baseFileName}.zip`, cdr, cdrZipBase64, signedXml };
  }
}
