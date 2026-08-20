import { SignedXml } from 'xml-crypto';
import type { InvoiceXmlSigner } from '../../application/ports/invoice-xml-signer.port';
import { SIGNATURE_ID } from '../xml/ubl-catalog-mapper';

export interface SigningCredentials {
  /** PEM-encoded private key (PKCS#8 or PKCS#1). */
  privateKeyPem: string;
  /** PEM-encoded X.509 certificate, embedded in ds:KeyInfo/X509Data. */
  certificatePem: string;
}

/**
 * XML-DSig enveloped signature over the whole Invoice document, as required
 * by SUNAT: ds:Signature (Id = IDSignSP, matching the declarative
 * cac:Signature reference) placed inside ext:ExtensionContent.
 *
 * Algorithms: RSA-SHA256 signature, SHA-256 digest, inclusive C14N with the
 * enveloped-signature transform. SUNAT accepts SHA-1 (legacy) and SHA-256;
 * SHA-256 is used deliberately. RSASSA-PKCS1 v1.5 is deterministic, so the
 * signer preserves the generator's same-input/same-output property.
 */
export class XmldsigInvoiceSigner implements InvoiceXmlSigner {
  constructor(private readonly credentials: SigningCredentials) {}

  sign(unsignedXml: string): string {
    const signer = new SignedXml({
      privateKey: this.credentials.privateKeyPem,
      publicCert: this.credentials.certificatePem,
      signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
      canonicalizationAlgorithm:
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    });

    signer.addReference({
      xpath: '/*',
      isEmptyUri: true,
      digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      ],
    });

    signer.computeSignature(unsignedXml, {
      prefix: 'ds',
      attrs: { Id: SIGNATURE_ID },
      location: {
        reference: "//*[local-name(.)='ExtensionContent']",
        action: 'append',
      },
    });

    return signer.getSignedXml();
  }
}
