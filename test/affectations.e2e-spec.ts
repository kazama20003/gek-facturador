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

const mixedBody = {
  ...fixtureRequestBody,
  correlative: 80,
  items: [
    {
      description: 'Gravado',
      unitCode: 'ZZ',
      quantity: '1',
      unitValue: '100.00',
    },
    {
      description: 'Exonerado',
      unitCode: 'ZZ',
      quantity: '1',
      unitValue: '50.00',
      igvAffectationCode: '20',
    },
  ],
};

describe('IGV affectations (e2e)', () => {
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

  it('renders a mixed taxed+exonerated invoice with per-category tax subtotals', async () => {
    const xml = await request(app.getHttpServer())
      .post('/invoices/xml/signed')
      .send(mixedBody)
      .expect(201);

    // per-line: taxed 1000/VAT, exonerated 9997 with code 20
    expect(xml.text).toContain('>10</cbc:TaxExemptionReasonCode>');
    expect(xml.text).toContain('>20</cbc:TaxExemptionReasonCode>');
    expect(xml.text).toContain('>9997</cbc:ID>'); // EXO tax scheme
    // invoice-level TaxTotal has both subtotals
    expect(xml.text).toContain(
      '<cbc:TaxableAmount currencyID="PEN">100.00</cbc:TaxableAmount>',
    );
    expect(xml.text).toContain(
      '<cbc:TaxableAmount currencyID="PEN">50.00</cbc:TaxableAmount>',
    );
    expect(xml.text).toContain(
      '<cbc:PayableAmount currencyID="PEN">168.00</cbc:PayableAmount>',
    );
  });

  it('rejects an unsupported affectation code at the DTO (400)', async () => {
    await request(app.getHttpServer())
      .post('/invoices')
      .send({
        ...mixedBody,
        correlative: 81,
        items: [
          {
            description: 'x',
            unitCode: 'ZZ',
            quantity: '1',
            unitValue: '1.00',
            igvAffectationCode: '99',
          },
        ],
      })
      .expect(400);
  });
});
