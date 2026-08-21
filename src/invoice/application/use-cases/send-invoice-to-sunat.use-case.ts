import { Invoice } from '../../domain/aggregates/invoice';
import { DomainError } from '../../../shared/domain/domain-error';
import type { InvoicePackager } from '../ports/invoice-packager.port';
import type { InvoiceXmlGenerator } from '../ports/invoice-xml-generator.port';
import type { InvoiceXmlSigner } from '../ports/invoice-xml-signer.port';
import type {
  CdrResult,
  SunatBillSender,
} from '../ports/sunat-bill-sender.port';
import type { UblXmlValidator } from '../ports/ubl-xml-validator.port';

/** Raised when the signed XML fails XSD validation before reaching SUNAT. */
export class InvalidSignedXmlError extends DomainError {}

export interface SendInvoiceToSunatResult {
  readonly fileName: string;
  readonly cdr: CdrResult;
  readonly cdrZipBase64: string;
  readonly signedXml: string;
  /** True when the invoice was already accepted and no new submission was made. */
  readonly alreadyAccepted?: boolean;
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
    /** Optional: validates the signed XML against the XSD before submitting. */
    private readonly validator?: UblXmlValidator,
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
    if (this.validator) {
      const validation = await this.validator.validate(signedXml);
      if (!validation.valid) {
        throw new InvalidSignedXmlError(
          `Signed XML failed XSD validation: ${validation.errors
            .slice(0, 3)
            .map((e) => e.message)
            .join('; ')}`,
        );
      }
    }
    const zip = await this.packager.package(baseFileName, signedXml);
    const { cdr, cdrZipBase64 } = await this.sender.send(
      `${baseFileName}.zip`,
      zip,
    );

    return { fileName: `${baseFileName}.zip`, cdr, cdrZipBase64, signedXml };
  }
}
