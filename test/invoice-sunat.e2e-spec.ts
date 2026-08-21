import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  SendInvoiceToSunatUseCase,
  type SendInvoiceToSunatResult,
} from '../src/invoice/application/use-cases/send-invoice-to-sunat.use-case';
import type {
  SunatBillSender,
  SunatSendResult,
} from '../src/invoice/application/ports/sunat-bill-sender.port';
import { XmldsigInvoiceSigner } from '../src/invoice/infrastructure/signature/xmldsig-invoice-signer';
import { SpanishAmountInWordsConverter } from '../src/invoice/infrastructure/words/spanish-amount-in-words.converter';
import { UblInvoiceMapper } from '../src/invoice/infrastructure/xml/ubl-invoice-mapper';
import { UblInvoiceXmlGenerator } from '../src/invoice/infrastructure/xml/ubl-invoice-xml-generator';
import { JszipInvoicePackager } from '../src/invoice/infrastructure/zip/jszip-invoice-packager';
import { DomainErrorFilter } from '../src/invoice/presentation/http/domain-error.filter';
import { fixtureRequestBody } from './fixtures/invoice.fixture';

jest.setTimeout(60_000);

/** Fake sender: keeps the e2e test off the network. */
const fakeSender: SunatBillSender = {
  getStatusCdr: () =>
    Promise.resolve({
      cdr: { responseCode: '0', description: 'ok', notes: [], accepted: true },
      cdrZipBase64: '',
    }),
  send(): Promise<SunatSendResult> {
    return Promise.resolve({
      cdr: {
        responseCode: '0',
        description: 'La Factura numero F001-1, ha sido aceptada',
        notes: [],
        accepted: true,
      },
      cdrZipBase64: 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==',
    });
  },
};

describe('POST /invoices/sunat/send (e2e, sender mocked)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const certDir = join(process.cwd(), 'test', 'fixtures', 'certs');
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SendInvoiceToSunatUseCase)
      .useValue(
        new SendInvoiceToSunatUseCase(
          new UblInvoiceXmlGenerator(
            new UblInvoiceMapper(new SpanishAmountInWordsConverter()),
          ),
          new XmldsigInvoiceSigner({
            privateKeyPem: readFileSync(join(certDir, 'test-key.pem'), 'utf8'),
            certificatePem: readFileSync(
              join(certDir, 'test-cert.pem'),
              'utf8',
            ),
          }),
          new JszipInvoicePackager(),
          fakeSender,
        ),
      )
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

  it('returns the SUNAT file name, parsed CDR and signed XML', async () => {
    const response = await request(app.getHttpServer())
      .post('/invoices/sunat/send')
      .send(fixtureRequestBody)
      .expect(201);

    const body = response.body as SendInvoiceToSunatResult;
    expect(body.fileName).toBe('20000000001-01-F001-1.zip');
    expect(body.cdr).toMatchObject({ responseCode: '0', accepted: true });
    expect(body.signedXml).toContain('Id="IDSignSP"');
  });

  it('rejects an invalid DTO with 400', async () => {
    await request(app.getHttpServer())
      .post('/invoices/sunat/send')
      .send({ ...fixtureRequestBody, items: [] })
      .expect(400);
  });
});
