import { Invoice } from '../../domain/aggregates/invoice';
import type { InvoiceXmlGenerator } from '../ports/invoice-xml-generator.port';
import type {
  UblXmlValidator,
  XmlValidationResult,
} from '../ports/ubl-xml-validator.port';

export interface GenerateInvoiceXmlResult {
  readonly xml: string;
  readonly validation: XmlValidationResult;
}

/**
 * Generates the UBL 2.1 XML for an issued invoice and validates it
 * structurally (well-formedness + XSD). No signing, no SUNAT submission.
 */
export class GenerateInvoiceXmlUseCase {
  constructor(
    private readonly generator: InvoiceXmlGenerator,
    private readonly validator: UblXmlValidator,
  ) {}

  async execute(invoice: Invoice): Promise<GenerateInvoiceXmlResult> {
    invoice.issue();
    const xml = this.generator.generate(invoice);
    const validation = await this.validator.validate(xml);
    return { xml, validation };
  }
}
