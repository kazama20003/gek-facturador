import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DomainErrorFilter } from '../src/invoice/presentation/http/domain-error.filter';
import type { GenerateInvoiceXmlResult } from '../src/invoice/application/use-cases/generate-invoice-xml.use-case';
import { fixtureRequestBody } from './fixtures/invoice.fixture';

jest.setTimeout(60_000);

describe('POST /invoices/xml (e2e)', () => {
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

  it('returns the UBL XML as application/xml', async () => {
    const response = await request(app.getHttpServer())
      .post('/invoices/xml')
      .send(fixtureRequestBody)
      .expect(201);

    expect(response.headers['content-type']).toContain('application/xml');
    expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(response.text).toContain('<cbc:ID>F001-1</cbc:ID>');
    expect(response.text).toContain('CIENTO DIECIOCHO CON 00/100 SOLES');
  });

  it('rejects an invalid DTO with 400', async () => {
    await request(app.getHttpServer())
      .post('/invoices/xml')
      .send({ ...fixtureRequestBody, currency: 'EUR' })
      .expect(400);
  });

  it('handles special characters end to end', async () => {
    const body = {
      ...fixtureRequestBody,
      items: [
        { ...fixtureRequestBody.items[0], description: 'Ñoño & <hijos> "SAC"' },
      ],
    };
    const response = await request(app.getHttpServer())
      .post('/invoices/xml')
      .send(body)
      .expect(201);
    expect(response.text).toContain('Ñoño &amp; &lt;hijos&gt;');
  });

  it('maps a tax-invalid invoice (issuer without address) to 422', async () => {
    const issuerWithoutAddress = {
      ruc: fixtureRequestBody.issuer.ruc,
      businessName: fixtureRequestBody.issuer.businessName,
    };
    await request(app.getHttpServer())
      .post('/invoices/xml')
      .send({ ...fixtureRequestBody, issuer: issuerWithoutAddress })
      .expect(422);
  });

  it('POST /invoices/xml/validate returns the XML and its XSD validation', async () => {
    const response = await request(app.getHttpServer())
      .post('/invoices/xml/validate')
      .send(fixtureRequestBody)
      .expect(201);

    const body = response.body as GenerateInvoiceXmlResult;
    expect(body.xml).toContain('<cbc:ID>F001-1</cbc:ID>');
    // known single deviation of the unsigned XML: empty ext:ExtensionContent
    expect(body.validation.valid).toBe(false);
    expect(body.validation.errors).toHaveLength(1);
    expect(body.validation.errors[0].message).toContain('ExtensionContent');
  });
});
