import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DomainErrorFilter } from '../src/invoice/presentation/http/domain-error.filter';
import type { SignInvoiceXmlResult } from '../src/invoice/application/use-cases/sign-invoice-xml.use-case';
import { fixtureRequestBody } from './fixtures/invoice.fixture';

jest.setTimeout(60_000);

describe('POST /invoices/xml/signed (e2e)', () => {
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

  it('returns the signed XML with ds:Signature inside ExtensionContent', async () => {
    const response = await request(app.getHttpServer())
      .post('/invoices/xml/signed')
      .send(fixtureRequestBody)
      .expect(201);

    expect(response.headers['content-type']).toContain('application/xml');
    expect(response.text).toMatch(
      /<ext:ExtensionContent>\s*<ds:Signature Id="IDSignSP"/,
    );
    expect(response.text).toContain('<ds:SignatureValue>');
    expect(response.text).toContain('<ds:X509Certificate>');
  });

  it('the signed XML passes XSD validation with zero errors', async () => {
    const response = await request(app.getHttpServer())
      .post('/invoices/xml/signed/validate')
      .send(fixtureRequestBody)
      .expect(201);

    const body = response.body as SignInvoiceXmlResult;
    expect(body.validation.errors).toEqual([]);
    expect(body.validation.valid).toBe(true);
    expect(body.xml).toContain('Id="IDSignSP"');
  });
});
