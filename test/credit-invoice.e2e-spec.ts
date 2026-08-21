import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { INVOICE_REPOSITORY } from '../src/invoice/application/ports/invoice-repository.port';
import { CreateInvoiceUseCase } from '../src/invoice/application/use-cases/create-invoice.use-case';
import { InMemoryInvoiceRepository } from '../src/invoice/infrastructure/persistence/in-memory-invoice.repository';
import { DomainErrorFilter } from '../src/invoice/presentation/http/domain-error.filter';
import { fixtureRequestBody } from './fixtures/invoice.fixture';

jest.setTimeout(60_000);

const creditBody = {
  ...fixtureRequestBody,
  correlative: 50,
  credit: {
    pendingAmount: '118.00',
    installments: [
      { amount: '60.00', dueDate: '2026-09-15' },
      { amount: '58.00', dueDate: '2026-09-30' },
    ],
  },
};

describe('Credit invoice with installments (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const repo = new InMemoryInvoiceRepository();
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(INVOICE_REPOSITORY)
      .useValue(repo)
      .overrideProvider(CreateInvoiceUseCase)
      .useValue(new CreateInvoiceUseCase(repo))
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

  it('creates a credit invoice and renders Credito + Cuota terms in the XML', async () => {
    await request(app.getHttpServer())
      .post('/invoices')
      .send(creditBody)
      .expect(201);

    const xml = await request(app.getHttpServer())
      .post('/invoices/xml/signed')
      .send({ ...creditBody, correlative: 51 })
      .expect(201);

    expect(xml.text).toContain(
      '<cbc:PaymentMeansID>Credito</cbc:PaymentMeansID>',
    );
    expect(xml.text).toContain(
      '<cbc:PaymentMeansID>Cuota001</cbc:PaymentMeansID>',
    );
    expect(xml.text).toContain(
      '<cbc:PaymentMeansID>Cuota002</cbc:PaymentMeansID>',
    );
    expect(xml.text).toContain(
      '<cbc:PaymentDueDate>2026-09-15</cbc:PaymentDueDate>',
    );
    expect(xml.text).toContain(
      '<cbc:Amount currencyID="PEN">60.00</cbc:Amount>',
    );
  });

  it('cash invoice still renders Contado', async () => {
    const xml = await request(app.getHttpServer())
      .post('/invoices/xml/signed')
      .send({ ...fixtureRequestBody, correlative: 52 })
      .expect(201);
    expect(xml.text).toContain(
      '<cbc:PaymentMeansID>Contado</cbc:PaymentMeansID>',
    );
  });

  it('rejects credit whose installments do not add up (422)', async () => {
    await request(app.getHttpServer())
      .post('/invoices')
      .send({
        ...creditBody,
        correlative: 53,
        credit: {
          pendingAmount: '118.00',
          installments: [{ amount: '100.00', dueDate: '2026-09-15' }],
        },
      })
      .expect(422);
  });
});
