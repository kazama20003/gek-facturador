import { Invoice } from '../../domain/aggregates/invoice';

/**
 * Extracts the DigestValue from a signed UBL XML (the ds:Signature reference
 * digest). SUNAT's printed representation QR ends with this hash.
 */
export function extractSignatureDigest(signedXml: string): string {
  return (
    signedXml
      .match(/<ds:DigestValue>([\s\S]*?)<\/ds:DigestValue>/)?.[1]
      .trim() ?? ''
  );
}

/**
 * Builds the SUNAT QR content for the printed representation (representación
 * impresa). Pipe-separated per SUNAT guide:
 *   RUC | tipoDoc | serie | correlativo | IGV | total | fechaEmision |
 *   tipoDocReceptor | nroDocReceptor | hash
 */
export function buildSunatQrContent(
  invoice: Invoice,
  signatureDigest: string,
): string {
  return [
    invoice.issuer.ruc.toString(),
    invoice.documentType,
    invoice.series.toString(),
    invoice.correlative.toNumber(),
    invoice.igv.toFixed(),
    invoice.total.toFixed(),
    invoice.issueDate.toISOString().slice(0, 10),
    invoice.customer.identity.code,
    invoice.customer.identity.toString(),
    signatureDigest,
  ].join('|');
}
