import { Module } from '@nestjs/common';
import { INVOICE_REPOSITORY } from './application/ports/invoice-repository.port';
import type { InvoiceRepository } from './application/ports/invoice-repository.port';
import { CreateInvoiceUseCase } from './application/use-cases/create-invoice.use-case';
import { FindInvoiceUseCase } from './application/use-cases/find-invoice.use-case';
import { GenerateInvoiceXmlUseCase } from './application/use-cases/generate-invoice-xml.use-case';
import { SendInvoiceToSunatUseCase } from './application/use-cases/send-invoice-to-sunat.use-case';
import { SubmitStoredInvoiceUseCase } from './application/use-cases/submit-stored-invoice.use-case';
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
import { InvoiceController } from './presentation/http/invoice.controller';
import { NoteController } from './presentation/http/note.controller';

function buildGenerator(): UblInvoiceXmlGenerator {
  return new UblInvoiceXmlGenerator(
    new UblInvoiceMapper(new SpanishAmountInWordsConverter()),
  );
}

function buildSigner(): XmldsigInvoiceSigner {
  return new XmldsigInvoiceSigner(loadSigningCredentials());
}

function buildSunatSender(): SunatSoapClient {
  return new SunatSoapClient({
    endpoint: process.env.SUNAT_ENDPOINT ?? SUNAT_BETA_ENDPOINT,
    // Beta accepts the generic SOL user MODDATOS/moddatos for any RUC.
    username: process.env.SUNAT_SOL_USERNAME ?? '20000000001MODDATOS',
    password: process.env.SUNAT_SOL_PASSWORD ?? 'moddatos',
  });
}

@Module({
  controllers: [InvoiceController, NoteController],
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
    { provide: CreateNoteUseCase, useFactory: () => new CreateNoteUseCase() },
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
          new SunatSoapClient({
            endpoint: process.env.SUNAT_ENDPOINT ?? SUNAT_BETA_ENDPOINT,
            // Beta accepts the generic SOL user MODDATOS/moddatos for any RUC.
            username: process.env.SUNAT_SOL_USERNAME ?? '20000000001MODDATOS',
            password: process.env.SUNAT_SOL_PASSWORD ?? 'moddatos',
          }),
        ),
    },
    {
      provide: SubmitStoredInvoiceUseCase,
      inject: [INVOICE_REPOSITORY, SendInvoiceToSunatUseCase],
      useFactory: (repo: InvoiceRepository, send: SendInvoiceToSunatUseCase) =>
        new SubmitStoredInvoiceUseCase(repo, send),
    },
  ],
})
export class InvoiceModule {}
