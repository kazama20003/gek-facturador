import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  INVOICE_REPOSITORY,
  type InvoiceRepository,
} from '../src/invoice/application/ports/invoice-repository.port';
import type { SunatSummarySender } from '../src/invoice/application/ports/sunat-summary-sender.port';
import {
  CreateInvoiceUseCase,
  type CreateInvoiceResult,
} from '../src/invoice/application/use-cases/create-invoice.use-case';
import {
  VoidInvoicesUseCase,
  type VoidInvoicesResult,
} from '../src/invoice/application/use-cases/void-invoices.use-case';
import type { FindInvoiceResult } from '../src/invoice/application/use-cases/find-invoice.use-case';
import { InMemoryInvoiceRepository } from '../src/invoice/infrastructure/persistence/in-memory-invoice.repository';
import { UblVoidedXmlGenerator } from '../src/invoice/infrastructure/xml/ubl-voided-xml-generator';
import { DomainErrorFilter } from '../src/invoice/presentation/http/domain-error.filter';
import { fixtureRequestBody } from './fixtures/invoice.fixture';

jest.setTimeout(60_000);

const fakeSender: SunatSummarySender = {
  sendSummary: () => Promise.resolve({ ticket: 'T-99' }),
  getStatus: () =>
    Promise.resolve({
      statusCode: '0',
      cdr: {
        responseCode: '0',
        description: 'baja aceptada',
        notes: [],
        accepted: true,
      },
      cdrZipBase64: 'UEs=',
    }),
};

describe('POST /voided-documents (e2e, in-memory repo, sender mocked)', () => {
  let app: INestApplication<App>;
  let repo: InvoiceRepository;

  beforeAll(async () => {
    repo = new InMemoryInvoiceRepository();
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(INVOICE_REPOSITORY)
      .useValue(repo)
      .overrideProvider(CreateInvoiceUseCase)
      .useValue(new CreateInvoiceUseCase(repo))
      .overrideProvider(VoidInvoicesUseCase)
      .useValue(
        new VoidInvoicesUseCase(
          repo,
          new UblVoidedXmlGenerator(),
          { sign: (xml) => xml },
          { package: () => Promise.resolve(Buffer.from('zip')) },
          fakeSender,
          undefined,
          () => '2026-08-21',
          () => Promise.resolve(),
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

  it('voids an accepted invoice end to end', async () => {
    const created = await request(app.getHttpServer())
      .post('/invoices')
      .send(fixtureRequestBody)
      .expect(201);
    const { id } = created.body as CreateInvoiceResult;
    await repo.recordSunatOutcome(id, {
      fileName: 'f.zip',
      cdr: { responseCode: '0', description: 'ok', notes: [], accepted: true },
      cdrZipBase64: '',
      signedXml: '',
    });

    const response = await request(app.getHttpServer())
      .post('/voided-documents')
      .send({
        voidCorrelative: 1,
        documents: [{ invoiceId: id, reason: 'Error' }],
      })
      .expect(201);

    const body = response.body as VoidInvoicesResult;
    expect(body.voidedId).toBe('RA-20260820-1');
    expect(body.cdr?.accepted).toBe(true);

    const after = await request(app.getHttpServer())
      .get(`/invoices/${id}`)
      .expect(200);
    expect((after.body as FindInvoiceResult).status).toBe('VOIDED');
  });

  it('rejects voiding a not-yet-accepted invoice with 422', async () => {
    const created = await request(app.getHttpServer())
      .post('/invoices')
      .send({ ...fixtureRequestBody, correlative: 7 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/voided-documents')
      .send({
        voidCorrelative: 2,
        documents: [
          { invoiceId: (created.body as CreateInvoiceResult).id, reason: 'x' },
        ],
      })
      .expect(422);
  });

  it('returns 404 for unknown ids', async () => {
    await request(app.getHttpServer())
      .post('/voided-documents')
      .send({
        voidCorrelative: 3,
        documents: [{ invoiceId: 'nope', reason: 'x' }],
      })
      .expect(404);
  });
});
