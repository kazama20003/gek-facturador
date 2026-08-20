/**
 * Port: packages the signed XML into the ZIP that SUNAT expects
 * (RUC-01-SERIE-CORRELATIVO.zip containing RUC-01-SERIE-CORRELATIVO.xml).
 */
export interface InvoicePackager {
  package(baseFileName: string, signedXml: string): Promise<Buffer>;
}

export const INVOICE_PACKAGER = Symbol('InvoicePackager');
