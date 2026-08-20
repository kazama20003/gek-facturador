import { Module } from '@nestjs/common';
import { CreateInvoiceUseCase } from './application/use-cases/create-invoice.use-case';
import { GenerateInvoiceXmlUseCase } from './application/use-cases/generate-invoice-xml.use-case';
import { SendInvoiceToSunatUseCase } from './application/use-cases/send-invoice-to-sunat.use-case';
import { SignInvoiceXmlUseCase } from './application/use-cases/sign-invoice-xml.use-case';
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
import { ChildProcessUblXmlValidator } from '../shared/infrastructure/xml/child-process-ubl-xml-validator';
import { InvoiceController } from './presentation/http/invoice.controller';

function buildGenerator(): UblInvoiceXmlGenerator {
  return new UblInvoiceXmlGenerator(
    new UblInvoiceMapper(new SpanishAmountInWordsConverter()),
  );
}

function buildSigner(): XmldsigInvoiceSigner {
  return new XmldsigInvoiceSigner(loadSigningCredentials());
}

@Module({
  controllers: [InvoiceController],
  providers: [
    // Factories keep application and infrastructure classes free of NestJS decorators.
    {
      provide: CreateInvoiceUseCase,
      useFactory: () => new CreateInvoiceUseCase(),
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
  ],
})
export class InvoiceModule {}
