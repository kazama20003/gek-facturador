import { readFileSync } from 'node:fs';
import forge from 'node-forge';
import type { SigningCredentials } from './xmldsig-invoice-signer';

/**
 * Extracts the signing key and certificate from a PKCS#12 (.pfx/.p12)
 * container — the format in which Peruvian tax certificates are delivered.
 */
export function loadCredentialsFromPfx(
  pfxPath: string,
  password: string,
): SigningCredentials {
  const pfxDer = readFileSync(pfxPath);
  const asn1 = forge.asn1.fromDer(
    forge.util.createBuffer(pfxDer.toString('binary')),
  );
  const pfx = forge.pkcs12.pkcs12FromAsn1(asn1, password);

  const keyBags =
    pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] ?? pfx.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag];
  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag })[
    forge.pki.oids.certBag
  ];

  const key = keyBags?.[0]?.key;
  const cert = certBags?.[0]?.cert;
  if (!key || !cert) {
    throw new Error(
      `PFX file "${pfxPath}" does not contain a private key and certificate.`,
    );
  }

  return {
    privateKeyPem: forge.pki.privateKeyToPem(key),
    certificatePem: forge.pki.certificateToPem(cert),
  };
}
