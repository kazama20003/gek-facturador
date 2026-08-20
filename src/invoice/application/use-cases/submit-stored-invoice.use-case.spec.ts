import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixtureInvoice } from '../../../../test/fixtures/invoice.fixture';
import { InvoiceNotFoundError } from '../../domain/errors/invoice-errors';
import type {
  SunatBillSender,
  SunatSendResult,
} from '../ports/sunat-bill-sender.port';
import { InMemoryInvoiceRepository } from '../../infrastructure/persistence/in-memory-invoice.repository';
import { XmldsigInvoiceSigner } from '../../infrastructure/signature/xmldsig-invoice-signer';
import { SpanishAmountInWordsConverter } from '../../infrastructure/words/spanish-amount-in-words.converter';
import { UblInvoiceMapper } from '../../infrastructure/xml/ubl-invoice-mapper';
import { UblInvoiceXmlGenerator } from '../../infrastructure/xml/ubl-invoice-xml-generator';
import { JszipInvoicePackager } from '../../infrastructure/zip/jszip-invoice-packager';
import { SendInvoiceToSunatUseCase } from './send-invoice-to-sunat.use-case';
import { SubmitStoredInvoiceUseCase } from './submit-stored-invoice.use-case';

const certDir = join(process.cwd(), 'test', 'fixtures', 'certs');

function sendPipeline(sender: SunatBillSender): SendInvoiceToSunatUseCase {
  return new SendInvoiceToSunatUseCase(
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
}

function fakeSender(accepted: boolean): SunatBillSender {
  return {
    send: (): Promise<SunatSendResult> =>
      Promise.resolve({
        cdr: {
          responseCode: accepted ? '0' : '2335',
          description: accepted ? 'aceptada' : 'rechazada',
          notes: [],
          accepted,
        },
        cdrZipBase64: 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==',
      }),
  };
}

describe('SubmitStoredInvoiceUseCase', () => {
  it('loads, submits and records ACCEPTED with the CDR', async () => {
    const repo = new InMemoryInvoiceRepository();
    const invoice = fixtureInvoice();
    await repo.save(invoice);

    const useCase = new SubmitStoredInvoiceUseCase(
      repo,
      sendPipeline(fakeSender(true)),
    );
    const result = await useCase.execute(invoice.id);

    expect(result.cdr.accepted).toBe(true);
    const stored = await repo.findById(invoice.id);
    expect(stored?.status).toBe('ACCEPTED');
    expect(stored?.sunat?.responseCode).toBe('0');
    expect(stored?.sunat?.fileName).toBe('20000000001-01-F001-1.zip');
  });

  it('records REJECTED when SUNAT rejects', async () => {
    const repo = new InMemoryInvoiceRepository();
    const invoice = fixtureInvoice();
    await repo.save(invoice);

    await new SubmitStoredInvoiceUseCase(
      repo,
      sendPipeline(fakeSender(false)),
    ).execute(invoice.id);

    const stored = await repo.findById(invoice.id);
    expect(stored?.status).toBe('REJECTED');
    expect(stored?.sunat?.responseCode).toBe('2335');
  });

  it('fails with InvoiceNotFoundError for unknown ids', async () => {
    const useCase = new SubmitStoredInvoiceUseCase(
      new InMemoryInvoiceRepository(),
      sendPipeline(fakeSender(true)),
    );
    await expect(useCase.execute('nope')).rejects.toThrow(InvoiceNotFoundError);
  });
});
