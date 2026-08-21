import { Module } from '@nestjs/common';
import { INVOICE_REPOSITORY } from './application/ports/invoice-repository.port';
import type { InvoiceRepository } from './application/ports/invoice-repository.port';
import { CreateInvoiceUseCase } from './application/use-cases/create-invoice.use-case';
import { FindInvoiceUseCase } from './application/use-cases/find-invoice.use-case';
import { GenerateInvoiceXmlUseCase } from './application/use-cases/generate-invoice-xml.use-case';
import { SendInvoiceToSunatUseCase } from './application/use-cases/send-invoice-to-sunat.use-case';
import { SubmitStoredInvoiceUseCase } from './application/use-cases/submit-stored-invoice.use-case';
import { QueryInvoiceCdrUseCase } from './application/use-cases/query-invoice-cdr.use-case';
import { RetryingSunatBillSender } from './infrastructure/sunat/retrying-sunat-bill-sender';
import type { SunatBillSender } from './application/ports/sunat-bill-sender.port';
import { SignInvoiceXmlUseCase } from './application/use-cases/sign-invoice-xml.use-case';
import { InMemoryInvoiceRepository } from './infrastructure/persistence/in-memory-invoice.repository';
import { PrismaInvoiceRepository } from './infrastructure/persistence/prisma-invoice.repository';
import { loadSigningCredentials } from './infrastructure/signature/signing-credentials.provider';
import { XmldsigInvoiceSigner } from './infrastructure/signature/xmldsig-invoice-signer';
import {
  SunatSoapClient,
  SUNAT_BETA_ENDPOINT,
} from './infrastructure/sunat/sunat-soap-client';
import { SpanishAmountInWordsConverter } from './infrastructure/words/spanish-amount-in-words.converter';
import { UblInvoiceMapper } from './infrastructure/xml/ubl-invoice-mapper';
import { UblInvoiceXmlGenerator } from './infrastructure/xml/ubl-invoice-xml-generator';
import { JszipInvoicePackager } from './infrastructure/zip/jszip-invoice-packager';
import { PrismaService } from '../shared/infrastructure/persistence/prisma.service';
import { ChildProcessUblXmlValidator } from '../shared/infrastructure/xml/child-process-ubl-xml-validator';
import { INVOICE_XML_SIGNER } from './application/ports/invoice-xml-signer.port';
import { CreateNoteUseCase } from './application/use-cases/create-note.use-case';
import {
  NOTE_XML_GENERATOR,
  SendNoteToSunatUseCase,
  type NoteXmlGenerator,
} from './application/use-cases/send-note-to-sunat.use-case';
import { UblNoteMapper } from './infrastructure/xml/ubl-note-mapper';
import { UblNoteXmlGenerator } from './infrastructure/xml/ubl-note-xml-generator';
import { NOTE_REPOSITORY } from './application/ports/note-repository.port';
import type { NoteRepository } from './application/ports/note-repository.port';
import { FindNoteUseCase } from './application/use-cases/find-note.use-case';
import { SubmitStoredNoteUseCase } from './application/use-cases/submit-stored-note.use-case';
import { InMemoryNoteRepository } from './infrastructure/persistence/in-memory-note.repository';
import { PrismaNoteRepository } from './infrastructure/persistence/prisma-note.repository';
import {
  SUMMARY_XML_GENERATOR,
  SendDailySummaryUseCase,
} from './application/use-cases/send-daily-summary.use-case';
import type { SummaryXmlGenerator } from './application/use-cases/send-daily-summary.use-case';
import { UblSummaryXmlGenerator } from './infrastructure/xml/ubl-summary-xml-generator';
import { InvoiceController } from './presentation/http/invoice.controller';
import { SummaryController } from './presentation/http/summary.controller';
import {
  VOIDED_XML_GENERATOR,
  VoidInvoicesUseCase,
} from './application/use-cases/void-invoices.use-case';
import type { VoidedXmlGenerator } from './application/use-cases/void-invoices.use-case';
import { UblVoidedXmlGenerator } from './infrastructure/xml/ubl-voided-xml-generator';
import { VoidedController } from './presentation/http/voided.controller';
import { SUBMISSION_REPOSITORY } from './application/ports/submission-repository.port';
import type { SubmissionRepository } from './application/ports/submission-repository.port';
import {
  InMemorySubmissionRepository,
  PrismaSubmissionRepository,
} from './infrastructure/persistence/submission.repositories';
import { NoteController } from './presentation/http/note.controller';

function buildGenerator(): UblInvoiceXmlGenerator {
  return new UblInvoiceXmlGenerator(
    new UblInvoiceMapper(new SpanishAmountInWordsConverter()),
  );
}

function buildSigner(): XmldsigInvoiceSigner {
  return new XmldsigInvoiceSigner(loadSigningCredentials());
}

function buildSunatSender(): SunatBillSender {
  const client = new SunatSoapClient({
    endpoint: process.env.SUNAT_ENDPOINT ?? SUNAT_BETA_ENDPOINT,
    // Beta accepts the generic SOL user MODDATOS/moddatos for any RUC.
    username: process.env.SUNAT_SOL_USERNAME ?? '20000000001MODDATOS',
    password: process.env.SUNAT_SOL_PASSWORD ?? 'moddatos',
  });
  // Retry transient failures (network, HTTP 5xx, the beta's intermittent 401).
  return new RetryingSunatBillSender(client);
}

/** Raw client for the async flows (summaries, voided) which need sendSummary/getStatus. */
function buildSunatSummarySender(): SunatSoapClient {
  return new SunatSoapClient({
    endpoint: process.env.SUNAT_ENDPOINT ?? SUNAT_BETA_ENDPOINT,
    username: process.env.SUNAT_SOL_USERNAME ?? '20000000001MODDATOS',
    password: process.env.SUNAT_SOL_PASSWORD ?? 'moddatos',
  });
}

@Module({
  controllers: [
    InvoiceController,
    NoteController,
    SummaryController,
    VoidedController,
  ],
  providers: [
    PrismaService,
    { provide: INVOICE_XML_SIGNER, useFactory: () => buildSigner() },
    {
      provide: NOTE_XML_GENERATOR,
      useFactory: (): NoteXmlGenerator =>
        new UblNoteXmlGenerator(
          new UblNoteMapper(new SpanishAmountInWordsConverter()),
        ),
    },
    {
      provide: NOTE_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService): NoteRepository =>
        process.env.DATABASE_URL
          ? new PrismaNoteRepository(prisma)
          : new InMemoryNoteRepository(),
    },
    {
      provide: CreateNoteUseCase,
      inject: [NOTE_REPOSITORY],
      useFactory: (repo: NoteRepository) => new CreateNoteUseCase(repo),
    },
    {
      provide: FindNoteUseCase,
      inject: [NOTE_REPOSITORY],
      useFactory: (repo: NoteRepository) => new FindNoteUseCase(repo),
    },
    {
      provide: SendNoteToSunatUseCase,
      inject: [NOTE_XML_GENERATOR, INVOICE_XML_SIGNER],
      useFactory: (generator: NoteXmlGenerator, signer: XmldsigInvoiceSigner) =>
        new SendNoteToSunatUseCase(
          generator,
          signer,
          new JszipInvoicePackager(),
          buildSunatSender(),
        ),
    },
    {
      provide: SubmitStoredNoteUseCase,
      inject: [NOTE_REPOSITORY, SendNoteToSunatUseCase],
      useFactory: (repo: NoteRepository, send: SendNoteToSunatUseCase) =>
        new SubmitStoredNoteUseCase(repo, send),
    },
    {
      provide: SUBMISSION_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService): SubmissionRepository =>
        process.env.DATABASE_URL
          ? new PrismaSubmissionRepository(prisma)
          : new InMemorySubmissionRepository(),
    },
    {
      provide: SUMMARY_XML_GENERATOR,
      useFactory: (): SummaryXmlGenerator => new UblSummaryXmlGenerator(),
    },
    {
      provide: SendDailySummaryUseCase,
      inject: [
        INVOICE_REPOSITORY,
        SUMMARY_XML_GENERATOR,
        INVOICE_XML_SIGNER,
        SUBMISSION_REPOSITORY,
      ],
      useFactory: (
        repo: InvoiceRepository,
        generator: SummaryXmlGenerator,
        signer: XmldsigInvoiceSigner,
      ) =>
        new SendDailySummaryUseCase(
          repo,
          generator,
          signer,
          new JszipInvoicePackager(),
          buildSunatSummarySender(),
        ),
    },
    {
      provide: VOIDED_XML_GENERATOR,
      useFactory: (): VoidedXmlGenerator => new UblVoidedXmlGenerator(),
    },
    {
      provide: VoidInvoicesUseCase,
      inject: [
        INVOICE_REPOSITORY,
        VOIDED_XML_GENERATOR,
        INVOICE_XML_SIGNER,
        SUBMISSION_REPOSITORY,
      ],
      useFactory: (
        repo: InvoiceRepository,
        generator: VoidedXmlGenerator,
        signer: XmldsigInvoiceSigner,
      ) =>
        new VoidInvoicesUseCase(
          repo,
          generator,
          signer,
          new JszipInvoicePackager(),
          buildSunatSummarySender(),
        ),
    },
    // Factories keep application and infrastructure classes free of NestJS decorators.
    {
      provide: INVOICE_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService): InvoiceRepository => {
        if (process.env.DATABASE_URL) {
          return new PrismaInvoiceRepository(prisma);
        }
        console.warn(
          '[emitec] DATABASE_URL not set — using the volatile in-memory repository. Data is lost on restart.',
        );
        return new InMemoryInvoiceRepository();
      },
    },
    {
      provide: CreateInvoiceUseCase,
      inject: [INVOICE_REPOSITORY],
      useFactory: (repo: InvoiceRepository) => new CreateInvoiceUseCase(repo),
    },
    {
      provide: FindInvoiceUseCase,
      inject: [INVOICE_REPOSITORY],
      useFactory: (repo: InvoiceRepository) => new FindInvoiceUseCase(repo),
    },
    {
      provide: GenerateInvoiceXmlUseCase,
      useFactory: () =>
        new GenerateInvoiceXmlUseCase(
          buildGenerator(),
          new ChildProcessUblXmlValidator(),
        ),
    },
    {
      provide: SignInvoiceXmlUseCase,
      useFactory: () =>
        new SignInvoiceXmlUseCase(
          buildGenerator(),
          buildSigner(),
          new ChildProcessUblXmlValidator(),
        ),
    },
    {
      provide: SendInvoiceToSunatUseCase,
      useFactory: () =>
        new SendInvoiceToSunatUseCase(
          buildGenerator(),
          buildSigner(),
          new JszipInvoicePackager(),
          buildSunatSender(),
        ),
    },
    {
      provide: SubmitStoredInvoiceUseCase,
      inject: [INVOICE_REPOSITORY, SendInvoiceToSunatUseCase],
      useFactory: (repo: InvoiceRepository, send: SendInvoiceToSunatUseCase) =>
        new SubmitStoredInvoiceUseCase(repo, send),
    },
    {
      provide: QueryInvoiceCdrUseCase,
      inject: [INVOICE_REPOSITORY],
      useFactory: (repo: InvoiceRepository) =>
        new QueryInvoiceCdrUseCase(repo, buildSunatSender()),
    },
  ],
})
export class InvoiceModule {}
