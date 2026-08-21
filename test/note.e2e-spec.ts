import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { INVOICE_REPOSITORY } from '../src/invoice/application/ports/invoice-repository.port';
import type {
  SunatBillSender,
  SunatSendResult,
} from '../src/invoice/application/ports/sunat-bill-sender.port';
import {
  SendNoteToSunatUseCase,
  type SendNoteToSunatResult,
  type NoteXmlGenerator,
} from '../src/invoice/application/use-cases/send-note-to-sunat.use-case';
import { InMemoryInvoiceRepository } from '../src/invoice/infrastructure/persistence/in-memory-invoice.repository';
import { SpanishAmountInWordsConverter } from '../src/invoice/infrastructure/words/spanish-amount-in-words.converter';
import { UblNoteMapper } from '../src/invoice/infrastructure/xml/ubl-note-mapper';
import { UblNoteXmlGenerator } from '../src/invoice/infrastructure/xml/ubl-note-xml-generator';
import { DomainErrorFilter } from '../src/invoice/presentation/http/domain-error.filter';
import { fixtureNoteRequestBody } from './fixtures/note.fixture';

jest.setTimeout(60_000);

const fakeSender: SunatBillSender = {
  getStatusCdr: () =>
    Promise.resolve({
      cdr: { responseCode: '0', description: 'ok', notes: [], accepted: true },
      cdrZipBase64: '',
    }),
  send: (fileName: string): Promise<SunatSendResult> =>
    Promise.resolve({
      cdr: {
        responseCode: '0',
        description: `${fileName} aceptada`,
        notes: [],
        accepted: true,
      },
      cdrZipBase64: 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==',
    }),
};

describe('Notes endpoints (e2e, sender mocked)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const generator: NoteXmlGenerator = new UblNoteXmlGenerator(
      new UblNoteMapper(new SpanishAmountInWordsConverter()),
    );
    const signer = { sign: (xml: string) => xml };
    const packager = { package: () => Promise.resolve(Buffer.from('zip')) };

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(INVOICE_REPOSITORY)
      .useValue(new InMemoryInvoiceRepository())
      .overrideProvider(SendNoteToSunatUseCase)
      .useValue(
        new SendNoteToSunatUseCase(generator, signer, packager, fakeSender),
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

  it('POST /credit-notes/sunat/send returns the CDR with file 07', async () => {
    const response = await request(app.getHttpServer())
      .post('/credit-notes/sunat/send')
      .send(fixtureNoteRequestBody)
      .expect(201);
    const body = response.body as SendNoteToSunatResult;
    expect(body.fileName).toBe('20000000001-07-F001-1.zip');
    expect(body.cdr.accepted).toBe(true);
    expect(body.signedXml).toContain('<CreditNote ');
  });

  it('POST /debit-notes/sunat/send returns the CDR with file 08', async () => {
    const response = await request(app.getHttpServer())
      .post('/debit-notes/sunat/send')
      .send({ ...fixtureNoteRequestBody, reasonCode: '02' })
      .expect(201);
    const body = response.body as SendNoteToSunatResult;
    expect(body.fileName).toBe('20000000001-08-F001-1.zip');
    expect(body.signedXml).toContain('<DebitNote ');
  });

  it('POST /credit-notes/xml/signed returns application/xml with the real signature', async () => {
    const response = await request(app.getHttpServer())
      .post('/credit-notes/xml/signed')
      .send(fixtureNoteRequestBody)
      .expect(201);
    expect(response.headers['content-type']).toContain('application/xml');
    expect(response.text).toContain('<ds:Signature Id="IDSignSP"');
  });

  it('rejects an unknown reason code with 422', async () => {
    await request(app.getHttpServer())
      .post('/credit-notes/sunat/send')
      .send({ ...fixtureNoteRequestBody, reasonCode: '99' })
      .expect(422);
  });

  it('rejects a malformed DTO with 400', async () => {
    const withoutModifies = { ...fixtureNoteRequestBody, modifies: undefined };
    await request(app.getHttpServer())
      .post('/credit-notes/sunat/send')
      .send(withoutModifies)
      .expect(400);
  });
});
