import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixtureRequestBody } from '../../../../test/fixtures/invoice.fixture';
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
import { CreateInvoiceUseCase } from './create-invoice.use-case';
import { SendInvoiceToSunatUseCase } from './send-invoice-to-sunat.use-case';
import { SubmitStoredInvoiceUseCase } from './submit-stored-invoice.use-case';
import { QueryInvoiceCdrUseCase } from './query-invoice-cdr.use-case';

const certDir = join(process.cwd(), 'test', 'fixtures', 'certs');

function countingSender(): SunatBillSender & {
  sends: number;
  cdrQueries: number;
} {
  const s = {
    sends: 0,
    cdrQueries: 0,
    send: (): Promise<SunatSendResult> => {
      s.sends += 1;
      return Promise.resolve({
        cdr: {
          responseCode: '0',
          description: 'aceptada',
          notes: [],
          accepted: true,
        },
        cdrZipBase64: 'UEs=',
      });
    },
    getStatusCdr: (): Promise<SunatSendResult> => {
      s.cdrQueries += 1;
      return Promise.resolve({
        cdr: {
          responseCode: '0',
          description: 'aceptada (cdr)',
          notes: [],
          accepted: true,
        },
        cdrZipBase64: 'UEs=',
      });
    },
  };
  return s;
}

async function setup() {
  const repo = new InMemoryInvoiceRepository();
  const created = await new CreateInvoiceUseCase(repo).execute(
    fixtureRequestBody,
  );
  const sender = countingSender();
  const pipeline = new SendInvoiceToSunatUseCase(
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
  return { repo, created, sender, pipeline };
}

describe('Submit idempotency', () => {
  it('does not resend an already-accepted invoice', async () => {
    const { repo, created, sender, pipeline } = await setup();
    const submit = new SubmitStoredInvoiceUseCase(repo, pipeline);

    const first = await submit.execute(created.id);
    expect(first.cdr.accepted).toBe(true);
    expect(sender.sends).toBe(1);

    const second = await submit.execute(created.id);
    expect(second.alreadyAccepted).toBe(true);
    expect(sender.sends).toBe(1); // no second submission
  });
});

describe('QueryInvoiceCdrUseCase (getStatusCdr)', () => {
  it('re-queries the CDR and updates the stored status', async () => {
    const { repo, created, sender } = await setup();
    const query = new QueryInvoiceCdrUseCase(repo, sender);

    const result = await query.execute(created.id);
    expect(result.accepted).toBe(true);
    expect(sender.cdrQueries).toBe(1);
    expect((await repo.findById(created.id))?.status).toBe('ACCEPTED');
  });
});
