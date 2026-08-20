import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SignedXml } from 'xml-crypto';
import { fixtureInvoice } from '../../../../test/fixtures/invoice.fixture';
import { SpanishAmountInWordsConverter } from '../words/spanish-amount-in-words.converter';
import { UblInvoiceMapper } from '../xml/ubl-invoice-mapper';
import { UblInvoiceXmlGenerator } from '../xml/ubl-invoice-xml-generator';
import { XmldsigInvoiceSigner } from './xmldsig-invoice-signer';

jest.setTimeout(60_000);

const certDir = join(process.cwd(), 'test', 'fixtures', 'certs');
const privateKeyPem = readFileSync(join(certDir, 'test-key.pem'), 'utf8');
const certificatePem = readFileSync(join(certDir, 'test-cert.pem'), 'utf8');

const signer = new XmldsigInvoiceSigner({ privateKeyPem, certificatePem });
const generator = new UblInvoiceXmlGenerator(
  new UblInvoiceMapper(new SpanishAmountInWordsConverter()),
);

function signedFixture(): string {
  return signer.sign(generator.generate(fixtureInvoice()));
}

describe('XmldsigInvoiceSigner', () => {
  const signed = signedFixture();

  it('places ds:Signature with Id=IDSignSP inside ext:ExtensionContent', () => {
    expect(signed).toMatch(
      /<ext:ExtensionContent>\s*<ds:Signature Id="IDSignSP"/,
    );
  });

  it('matches the declarative cac:Signature reference (#IDSignSP)', () => {
    expect(signed).toContain('<cbc:URI>#IDSignSP</cbc:URI>');
    expect(signed).toContain('Id="IDSignSP"');
  });

  it('uses RSA-SHA256 with enveloped-signature transform and embeds the X.509 certificate', () => {
    expect(signed).toContain(
      'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    );
    expect(signed).toContain(
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
    );
    expect(signed).toContain('http://www.w3.org/2001/04/xmlenc#sha256');
    expect(signed).toContain('<ds:X509Certificate>');
    expect(signed).toContain('<ds:Reference URI="">');
  });

  it('produces a cryptographically valid signature', () => {
    const signatureXml = signed.match(
      /<ds:Signature[\s\S]*?<\/ds:Signature>/,
    )?.[0];
    expect(signatureXml).toBeDefined();

    const verifier = new SignedXml({ publicCert: certificatePem });
    verifier.loadSignature(signatureXml as string);
    expect(verifier.checkSignature(signed)).toBe(true);
  });

  it('is tamper-evident: modifying an amount invalidates the signature', () => {
    const tampered = signed.replace(
      '<cbc:PayableAmount currencyID="PEN">118.00</cbc:PayableAmount>',
      '<cbc:PayableAmount currencyID="PEN">1.00</cbc:PayableAmount>',
    );
    const signatureXml = tampered.match(
      /<ds:Signature[\s\S]*?<\/ds:Signature>/,
    )?.[0];
    const verifier = new SignedXml({ publicCert: certificatePem });
    verifier.loadSignature(signatureXml as string);
    let valid = false;
    try {
      valid = verifier.checkSignature(tampered);
    } catch {
      valid = false;
    }
    expect(valid).toBe(false);
  });

  it('is deterministic for the same input (RSASSA-PKCS1 v1.5)', () => {
    expect(signedFixture()).toBe(signedFixture());
  });
});
