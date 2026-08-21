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

describe('Stage 7 tax cases (e2e)', () => {
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

  async function xml(body: object): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/invoices/xml/signed')
      .send(body)
      .expect(201);
    return res.text;
  }

  it('line discount renders AllowanceCharge with base', async () => {
    const text = await xml({
      ...fixtureRequestBody,
      correlative: 90,
      items: [
        {
          description: 'S',
          unitCode: 'ZZ',
          quantity: '1',
          unitValue: '100.00',
          discount: '20.00',
        },
      ],
    });
    expect(text).toContain('<cbc:ChargeIndicator>false</cbc:ChargeIndicator>');
    expect(text).toContain(
      '<cbc:LineExtensionAmount currencyID="PEN">80.00</cbc:LineExtensionAmount>',
    );
    expect(text).toContain(
      '<cbc:BaseAmount currencyID="PEN">100.00</cbc:BaseAmount>',
    );
  });

  it('global discount reduces the base and skips AllowanceTotalAmount', async () => {
    const text = await xml({
      ...fixtureRequestBody,
      correlative: 91,
      globalDiscount: '10.00',
    });
    expect(text).toContain('>02</cbc:AllowanceChargeReasonCode>');
    expect(text).toContain(
      '<cbc:PayableAmount currencyID="PEN">106.20</cbc:PayableAmount>',
    );
    expect(text).not.toContain('AllowanceTotalAmount');
  });

  it('free line (11) renders referential price type 02 and zero price', async () => {
    const text = await xml({
      ...fixtureRequestBody,
      correlative: 92,
      items: [
        {
          description: 'Gravado',
          unitCode: 'ZZ',
          quantity: '1',
          unitValue: '100.00',
        },
        {
          description: 'Gratis',
          unitCode: 'ZZ',
          quantity: '1',
          unitValue: '50.00',
          igvAffectationCode: '11',
        },
      ],
    });
    expect(text).toContain('>11</cbc:TaxExemptionReasonCode>');
    expect(text).toContain('>9996</cbc:ID>');
    expect(text).toContain('>02</cbc:PriceTypeCode>');
    expect(text).toContain(
      '<cbc:PayableAmount currencyID="PEN">118.00</cbc:PayableAmount>',
    );
  });

  it('detraction renders legend 2006, PaymentMeans and PaymentTerms Detraccion', async () => {
    const text = await xml({
      ...fixtureRequestBody,
      correlative: 93,
      items: [
        {
          description: 'Servicio',
          unitCode: 'ZZ',
          quantity: '1',
          unitValue: '1000.00',
        },
      ],
      detraction: {
        code: '037',
        percent: '12',
        account: '00-085-125874',
        operationType: '1001',
      },
    });
    expect(text).toContain('languageLocaleID="2006"');
    expect(text).toContain('<cbc:ID>Detraccion</cbc:ID>');
    expect(text).toContain('<cbc:PaymentMeansCode>999</cbc:PaymentMeansCode>');
    expect(text).toContain('listID="1001"');
    expect(text).toContain(
      '<cbc:ItemClassificationCode>037</cbc:ItemClassificationCode>',
    );
  });
});
