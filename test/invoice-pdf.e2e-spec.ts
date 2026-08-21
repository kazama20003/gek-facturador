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

const validBody = {
  series: 'F001',
  correlative: 1,
  issueDate: '2026-08-20',
  currency: 'PEN',
  issuer: {
    ruc: '20000000001',
    businessName: 'EMITEC SAC',
    address: {
      ubigeo: '150101',
      department: 'LIMA',
      province: 'LIMA',
      district: 'LIMA',
      addressLine: 'AV. SIEMPRE VIVA 123',
    },
  },
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

describe('GET /invoices/:id/pdf (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    // Tests never touch a real database, even if a local .env sets DATABASE_URL.
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

  it('returns the printed representation as a PDF', async () => {
    const created = await request(app.getHttpServer())
      .post('/invoices')
      .send(validBody)
      .expect(201);
    const { id } = created.body as CreateInvoiceResult;

    const response = await request(app.getHttpServer())
      .get(`/invoices/${id}/pdf`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(response.headers['content-type']).toContain('application/pdf');
    const body = response.body as Buffer;
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(body.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  it('returns 404 for an unknown invoice id', async () => {
    await request(app.getHttpServer())
      .get('/invoices/does-not-exist/pdf')
      .expect(404);
  });
});
