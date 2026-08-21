import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixtureInvoice } from '../../../../test/fixtures/invoice.fixture';
import type {
  SunatBillSender,
  SunatSendResult,
} from '../ports/sunat-bill-sender.port';
import { XmldsigInvoiceSigner } from '../../infrastructure/signature/xmldsig-invoice-signer';
import { SpanishAmountInWordsConverter } from '../../infrastructure/words/spanish-amount-in-words.converter';
import { UblInvoiceMapper } from '../../infrastructure/xml/ubl-invoice-mapper';
import { UblInvoiceXmlGenerator } from '../../infrastructure/xml/ubl-invoice-xml-generator';
import { JszipInvoicePackager } from '../../infrastructure/zip/jszip-invoice-packager';
import { SendInvoiceToSunatUseCase } from './send-invoice-to-sunat.use-case';

const certDir = join(process.cwd(), 'test', 'fixtures', 'certs');

class FakeSender implements SunatBillSender {
  sentFileName?: string;
  sentZip?: Buffer;

  send(zipFileName: string, zipContent: Buffer): Promise<SunatSendResult> {
    this.sentFileName = zipFileName;
    this.sentZip = zipContent;
    return Promise.resolve({
      cdr: {
        responseCode: '0',
        description: 'La Factura numero F001-1, ha sido aceptada',
        notes: [],
        accepted: true,
      },
      cdrZipBase64: 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==',
    });
  }

  getStatusCdr(): Promise<SunatSendResult> {
    return Promise.resolve({
      cdr: { responseCode: '0', description: 'ok', notes: [], accepted: true },
      cdrZipBase64: '',
    });
  }
}

describe('SendInvoiceToSunatUseCase', () => {
  it('signs, zips with the SUNAT file name and returns the parsed CDR', async () => {
    const sender = new FakeSender();
    const useCase = new SendInvoiceToSunatUseCase(
      new UblInvoiceXmlGenerator(
        new UblInvoiceMapper(new SpanishAmountInWordsConverter()),
      ),
      new XmldsigInvoiceSigner({
        privateKeyPem: readFileSync(join(certDir, 'test-key.pem'), 'utf8'),
        certificatePem: readFileSync(join(certDir, 'test-cert.pem'), 'utf8'),
      }),
      new JszipInvoicePackager(),
      sender,
    );

    const result = await useCase.execute(fixtureInvoice());

    expect(result.fileName).toBe('20000000001-01-F001-1.zip');
    expect(sender.sentFileName).toBe('20000000001-01-F001-1.zip');
    expect(sender.sentZip?.length).toBeGreaterThan(0);
    expect(result.signedXml).toContain('Id="IDSignSP"');
    expect(result.cdr.accepted).toBe(true);
    expect(result.cdr.responseCode).toBe('0');
  });
});
