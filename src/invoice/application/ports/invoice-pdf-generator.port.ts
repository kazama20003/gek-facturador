import { Invoice } from '../../domain/aggregates/invoice';

/**
 * Port: renders the printed representation (representación impresa) of an
 * issued invoice as a PDF. Infrastructure implements it. The signed XML is
 * supplied so the QR can carry the SUNAT signature digest.
 */
export interface InvoicePdfGenerator {
  generate(invoice: Invoice, signedXml: string): Promise<Buffer>;
}

export const INVOICE_PDF_GENERATOR = Symbol('InvoicePdfGenerator');
