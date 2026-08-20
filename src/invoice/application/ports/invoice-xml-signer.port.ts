/**
 * Port: applies the XML-DSig enveloped signature required by SUNAT,
 * inserting ds:Signature into ext:ExtensionContent.
 */
export interface InvoiceXmlSigner {
  sign(unsignedXml: string): string;
}

export const INVOICE_XML_SIGNER = Symbol('InvoiceXmlSigner');
