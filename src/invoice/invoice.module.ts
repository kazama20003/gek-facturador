import { Module } from '@nestjs/common';
import { CreateInvoiceUseCase } from './application/use-cases/create-invoice.use-case';
import { GenerateInvoiceXmlUseCase } from './application/use-cases/generate-invoice-xml.use-case';
import { SpanishAmountInWordsConverter } from './infrastructure/words/spanish-amount-in-words.converter';
import { UblInvoiceMapper } from './infrastructure/xml/ubl-invoice-mapper';
import { UblInvoiceXmlGenerator } from './infrastructure/xml/ubl-invoice-xml-generator';
import { ChildProcessUblXmlValidator } from '../shared/infrastructure/xml/child-process-ubl-xml-validator';
import { InvoiceController } from './presentation/http/invoice.controller';

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
          new UblInvoiceXmlGenerator(
            new UblInvoiceMapper(new SpanishAmountInWordsConverter()),
          ),
          new ChildProcessUblXmlValidator(),
        ),
    },
  ],
})
export class InvoiceModule {}
