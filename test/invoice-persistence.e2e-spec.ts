import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  INVOICE_REPOSITORY,
  type InvoiceRepository,
} from '../src/invoice/application/ports/invoice-repository.port';
import type {
  SunatBillSender,
  SunatSendResult,
} from '../src/invoice/application/ports/sunat-bill-sender.port';
import { CreateInvoiceUseCase } from '../src/invoice/application/use-cases/create-invoice.use-case';
import type { CreateInvoiceResult } from '../src/invoice/application/use-cases/create-invoice.use-case';
import type { FindInvoiceResult } from '../src/invoice/application/use-cases/find-invoice.use-case';
import { SendInvoiceToSunatUseCase } from '../src/invoice/application/use-cases/send-invoice-to-sunat.use-case';
import { SubmitStoredInvoiceUseCase } from '../src/invoice/application/use-cases/submit-stored-invoice.use-case';
import { InMemoryInvoiceRepository } from '../src/invoice/infrastructure/persistence/in-memory-invoice.repository';
import { XmldsigInvoiceSigner } from '../src/invoice/infrastructure/signature/xmldsig-invoice-signer';
import { SpanishAmountInWordsConverter } from '../src/invoice/infrastructure/words/spanish-amount-in-words.converter';
import { UblInvoiceMapper } from '../src/invoice/infrastructure/xml/ubl-invoice-mapper';
import { UblInvoiceXmlGenerator } from '../src/invoice/infrastructure/xml/ubl-invoice-xml-generator';
import { JszipInvoicePackager } from '../src/invoice/infrastructure/zip/jszip-invoice-packager';
import { DomainErrorFilter } from '../src/invoice/presentation/http/domain-error.filter';
import { fixtureRequestBody } from './fixtures/invoice.fixture';

jest.setTimeout(60_000);

const fakeSender: SunatBillSender = {
  send: (): Promise<SunatSendResult> =>
    Promise.resolve({
      cdr: {
        responseCode: '0',
        description: 'aceptada',
        notes: [],
        accepted: true,
      },
      cdrZipBase64: 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==',
    }),
};

describe('Persisted invoice flow (e2e, in-memory repo, sender mocked)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const certDir = join(process.cwd(), 'test', 'fixtures', 'certs');
    const repo: InvoiceRepository = new InMemoryInvoiceRepository();
    const sendPipeline = new SendInvoiceToSunatUseCase(
      new UblInvoiceXmlGenerator(
        new UblInvoiceMapper(new SpanishAmountInWordsConverter()),
      ),
      new XmldsigInvoiceSigner({
        privateKeyPem: readFileSync(join(certDir, 'test-key.pem'), 'utf8'),
        certificatePem: readFileSync(join(certDir, 'test-cert.pem'), 'utf8'),
      }),
      new JszipInvoicePackager(),
      fakeSender,
    );

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(INVOICE_REPOSITORY)
      .useValue(repo)
      .overrideProvider(CreateInvoiceUseCase)
      .useValue(new CreateInvoiceUseCase(repo))
      .overrideProvider(SubmitStoredInvoiceUseCase)
      .useValue(new SubmitStoredInvoiceUseCase(repo, sendPipeline))
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new DomainErrorFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('create -> get -> submit -> get shows ACCEPTED with CDR', async () => {
    const created = await request(app.getHttpServer())
      .post('/invoices')
      .send(fixtureRequestBody)
      .expect(201);
    const { id } = created.body as CreateInvoiceResult;
    expect(id).toBeDefined();

    const found = await request(app.getHttpServer())
      .get(`/invoices/${id}`)
      .expect(200);
    expect((found.body as FindInvoiceResult).status).toBe('ISSUED');
    expect((found.body as FindInvoiceResult).total).toBe('118.00');

    await request(app.getHttpServer())
      .post(`/invoices/${id}/sunat/send`)
      .expect(201);

    const after = await request(app.getHttpServer())
      .get(`/invoices/${id}`)
      .expect(200);
    const body = after.body as FindInvoiceResult;
    expect(body.status).toBe('ACCEPTED');
    expect(body.sunat).toMatchObject({
      responseCode: '0',
      fileName: '20000000001-01-F001-1.zip',
    });
  });

  it('rejects a duplicated series+correlative with 409', async () => {
    await request(app.getHttpServer())
      .post('/invoices')
      .send(fixtureRequestBody)
      .expect(409);
  });

  it('returns 404 for an unknown invoice', async () => {
    await request(app.getHttpServer()).get('/invoices/unknown-id').expect(404);
    await request(app.getHttpServer())
      .post('/invoices/unknown-id/sunat/send')
      .expect(404);
  });
});
