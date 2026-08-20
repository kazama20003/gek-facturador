import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ChildProcessUblXmlValidator } from '../../../shared/infrastructure/xml/child-process-ubl-xml-validator';
import { fixtureInvoice } from '../../../../test/fixtures/invoice.fixture';
import { SpanishAmountInWordsConverter } from '../words/spanish-amount-in-words.converter';
import { UblInvoiceMapper } from '../xml/ubl-invoice-mapper';
import { UblInvoiceXmlGenerator } from '../xml/ubl-invoice-xml-generator';
import { XmldsigInvoiceSigner } from './xmldsig-invoice-signer';

jest.setTimeout(60_000);

describe('Signed invoice XSD validation', () => {
  it('the signed XML is 100% valid against the UBL 2.1 XSD (no deviations left)', async () => {
    const certDir = join(process.cwd(), 'test', 'fixtures', 'certs');
    const signer = new XmldsigInvoiceSigner({
      privateKeyPem: readFileSync(join(certDir, 'test-key.pem'), 'utf8'),
      certificatePem: readFileSync(join(certDir, 'test-cert.pem'), 'utf8'),
    });
    const generator = new UblInvoiceXmlGenerator(
      new UblInvoiceMapper(new SpanishAmountInWordsConverter()),
    );

    const signed = signer.sign(generator.generate(fixtureInvoice()));
    const result = await new ChildProcessUblXmlValidator().validate(signed);

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});
