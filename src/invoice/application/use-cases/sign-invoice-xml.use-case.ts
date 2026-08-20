import { Invoice } from '../../domain/aggregates/invoice';
import type { InvoiceXmlGenerator } from '../ports/invoice-xml-generator.port';
import type { InvoiceXmlSigner } from '../ports/invoice-xml-signer.port';
import type {
  UblXmlValidator,
  XmlValidationResult,
} from '../ports/ubl-xml-validator.port';

export interface SignInvoiceXmlResult {
  readonly xml: string;
  readonly validation: XmlValidationResult;
}

/**
 * Generates the UBL XML, applies the XML-DSig signature and validates the
 * signed document against the XSD. Still no SUNAT submission.
 */
export class SignInvoiceXmlUseCase {
  constructor(
    private readonly generator: InvoiceXmlGenerator,
    private readonly signer: InvoiceXmlSigner,
    private readonly validator: UblXmlValidator,
  ) {}

  async execute(invoice: Invoice): Promise<SignInvoiceXmlResult> {
    invoice.issue();
    const xml = this.signer.sign(this.generator.generate(invoice));
    const validation = await this.validator.validate(xml);
    return { xml, validation };
  }
}
