import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import type { CreateInvoiceResult } from '../src/invoice/application/use-cases/create-invoice.use-case';
import { DomainErrorFilter } from '../src/invoice/presentation/http/domain-error.filter';

const validBody = {
  series: 'F001',
  correlative: 1,
  issueDate: '2026-08-20',
  currency: 'PEN',
  issuer: { ruc: '20000000001', businessName: 'EMITEC SAC' },
  customer: { ruc: '20100070970', businessName: 'CLIENTE SAC' },
  items: [
    {
      code: 'SERV-001',
      description: 'Servicio de transporte',
      unitCode: 'ZZ',
      quantity: '1',
      unitValue: '100.00',
    },
  ],
};

describe('POST /invoices (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

  it('creates an invoice and returns correct totals', async () => {
    const response = await request(app.getHttpServer())
      .post('/invoices')
      .send(validBody)
      .expect(201);

    const body = response.body as CreateInvoiceResult;
    expect(body).toMatchObject({
      documentType: '01',
      series: 'F001',
      correlative: 1,
      currency: 'PEN',
      taxableAmount: '100.00',
      igv: '18.00',
      saleValue: '100.00',
      total: '118.00',
    });
    expect(body.items[0]).toMatchObject({
      description: 'Servicio de transporte',
      quantity: '1',
      unitValue: '100.00',
      taxableAmount: '100.00',
      igv: '18.00',
      unitPrice: '118.00',
      total: '118.00',
    });
  });

  it('rejects malformed input with 400', async () => {
    await request(app.getHttpServer())
      .post('/invoices')
      .send({ ...validBody, correlative: 'uno', items: [] })
      .expect(400);
  });

  it('maps domain rule violations to 422', async () => {
    await request(app.getHttpServer())
      .post('/invoices')
      .send({
        ...validBody,
        issuer: { ruc: '20123456789', businessName: 'X SAC' },
      })
      .expect(422);
  });
});
