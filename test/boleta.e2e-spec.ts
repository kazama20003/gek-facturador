import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { INVOICE_REPOSITORY } from '../src/invoice/application/ports/invoice-repository.port';
import {
  CreateInvoiceUseCase,
  type CreateInvoiceResult,
} from '../src/invoice/application/use-cases/create-invoice.use-case';
import { InMemoryInvoiceRepository } from '../src/invoice/infrastructure/persistence/in-memory-invoice.repository';
import { DomainErrorFilter } from '../src/invoice/presentation/http/domain-error.filter';
import { fixtureRequestBody } from './fixtures/invoice.fixture';

jest.setTimeout(60_000);

const boletaBody = {
  ...fixtureRequestBody,
  documentType: '03',
  series: 'B001',
  customer: { dni: '12345678', businessName: 'JUAN PEREZ' },
};

describe('Boletas (e2e, in-memory repo)', () => {
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

  it('creates and persists a boleta (03) with a DNI customer', async () => {
    const response = await request(app.getHttpServer())
      .post('/invoices')
      .send(boletaBody)
      .expect(201);

    const body = response.body as CreateInvoiceResult;
    expect(body.documentType).toBe('03');
    expect(body.series).toBe('B001');
    expect(body.customer).toEqual({
      documentType: '1',
      documentNumber: '12345678',
      businessName: 'JUAN PEREZ',
    });
    expect(body.total).toBe('118.00');

    await request(app.getHttpServer()).get(`/invoices/${body.id}`).expect(200);
  });

  it('generates the signed boleta XML with type 03 and DNI schemeID', async () => {
    const response = await request(app.getHttpServer())
      .post('/invoices/xml/signed')
      .send({ ...boletaBody, correlative: 2 })
      .expect(201);

    expect(response.text).toContain('>03</cbc:InvoiceTypeCode>');
    expect(response.text).toContain('schemeID="1"');
    expect(response.text).toContain('<cbc:ID>B001-2</cbc:ID>');
  });

  it('rejects an invoice (01) with a DNI customer with 422', async () => {
    await request(app.getHttpServer())
      .post('/invoices')
      .send({
        ...fixtureRequestBody,
        customer: { dni: '12345678', businessName: 'X' },
      })
      .expect(422);
  });

  it('rejects a boleta with an F series with 422', async () => {
    await request(app.getHttpServer())
      .post('/invoices')
      .send({ ...boletaBody, series: 'F001', correlative: 3 })
      .expect(422);
  });
});
