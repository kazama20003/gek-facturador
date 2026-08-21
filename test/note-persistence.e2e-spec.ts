import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { INVOICE_REPOSITORY } from '../src/invoice/application/ports/invoice-repository.port';
import {
  NOTE_REPOSITORY,
  type NoteRepository,
} from '../src/invoice/application/ports/note-repository.port';
import type {
  SunatBillSender,
  SunatSendResult,
} from '../src/invoice/application/ports/sunat-bill-sender.port';
import {
  CreateNoteUseCase,
  type CreateNoteResult,
} from '../src/invoice/application/use-cases/create-note.use-case';
import type { FindNoteResult } from '../src/invoice/application/use-cases/find-note.use-case';
import { SendNoteToSunatUseCase } from '../src/invoice/application/use-cases/send-note-to-sunat.use-case';
import { SubmitStoredNoteUseCase } from '../src/invoice/application/use-cases/submit-stored-note.use-case';
import { InMemoryInvoiceRepository } from '../src/invoice/infrastructure/persistence/in-memory-invoice.repository';
import { InMemoryNoteRepository } from '../src/invoice/infrastructure/persistence/in-memory-note.repository';
import { SpanishAmountInWordsConverter } from '../src/invoice/infrastructure/words/spanish-amount-in-words.converter';
import { UblNoteMapper } from '../src/invoice/infrastructure/xml/ubl-note-mapper';
import { UblNoteXmlGenerator } from '../src/invoice/infrastructure/xml/ubl-note-xml-generator';
import { DomainErrorFilter } from '../src/invoice/presentation/http/domain-error.filter';
import { fixtureNoteRequestBody } from './fixtures/note.fixture';

jest.setTimeout(60_000);

const fakeSender: SunatBillSender = {
  send: (): Promise<SunatSendResult> =>
    Promise.resolve({
      cdr: {
        responseCode: '0',
        description: 'aceptada',
        notes: [],
        accepted: true,
      },
      cdrZipBase64: 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==',
    }),
};

describe('Persisted notes flow (e2e, in-memory repos, sender mocked)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const noteRepo: NoteRepository = new InMemoryNoteRepository();
    const sendPipeline = new SendNoteToSunatUseCase(
      new UblNoteXmlGenerator(
        new UblNoteMapper(new SpanishAmountInWordsConverter()),
      ),
      { sign: (xml: string) => xml },
      { package: () => Promise.resolve(Buffer.from('zip')) },
      fakeSender,
    );

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(INVOICE_REPOSITORY)
      .useValue(new InMemoryInvoiceRepository())
      .overrideProvider(NOTE_REPOSITORY)
      .useValue(noteRepo)
      .overrideProvider(CreateNoteUseCase)
      .useValue(new CreateNoteUseCase(noteRepo))
      .overrideProvider(SubmitStoredNoteUseCase)
      .useValue(new SubmitStoredNoteUseCase(noteRepo, sendPipeline))
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

  it('create -> get -> submit -> get shows ACCEPTED with CDR', async () => {
    const created = await request(app.getHttpServer())
      .post('/credit-notes')
      .send(fixtureNoteRequestBody)
      .expect(201);
    const body = created.body as CreateNoteResult;
    expect(body.documentType).toBe('07');
    expect(body.total).toBe('118.00');
    expect(body.modifies).toEqual({
      documentType: '01',
      series: 'F001',
      correlative: 1,
    });

    const found = await request(app.getHttpServer())
      .get(`/notes/${body.id}`)
      .expect(200);
    expect((found.body as FindNoteResult).status).toBe('ISSUED');

    await request(app.getHttpServer())
      .post(`/notes/${body.id}/sunat/send`)
      .expect(201);

    const after = await request(app.getHttpServer())
      .get(`/notes/${body.id}`)
      .expect(200);
    const stored = after.body as FindNoteResult;
    expect(stored.status).toBe('ACCEPTED');
    expect(stored.sunat?.fileName).toBe('20000000001-07-F001-1.zip');
  });

  it('a debit note with the same series+correlative is NOT a duplicate of the credit note', async () => {
    const created = await request(app.getHttpServer())
      .post('/debit-notes')
      .send({ ...fixtureNoteRequestBody, reasonCode: '02' })
      .expect(201);
    expect((created.body as CreateNoteResult).documentType).toBe('08');
  });

  it('rejects a duplicated credit note with 409', async () => {
    await request(app.getHttpServer())
      .post('/credit-notes')
      .send(fixtureNoteRequestBody)
      .expect(409);
  });

  it('returns 404 for an unknown note', async () => {
    await request(app.getHttpServer()).get('/notes/unknown').expect(404);
    await request(app.getHttpServer())
      .post('/notes/unknown/sunat/send')
      .expect(404);
  });
});
