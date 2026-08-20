import { Invoice } from '../../domain/aggregates/invoice';

/** Port: renders an issued invoice as UBL 2.1 XML. Infrastructure implements it. */
export interface InvoiceXmlGenerator {
  generate(invoice: Invoice): string;
}

export const INVOICE_XML_GENERATOR = Symbol('InvoiceXmlGenerator');
