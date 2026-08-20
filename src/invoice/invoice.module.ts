import { Module } from '@nestjs/common';
import { CreateInvoiceUseCase } from './application/use-cases/create-invoice.use-case';
import { InvoiceController } from './presentation/http/invoice.controller';

@Module({
  controllers: [InvoiceController],
  providers: [
    // Factory keeps the use case free of NestJS decorators (pure application layer).
    {
      provide: CreateInvoiceUseCase,
      useFactory: () => new CreateInvoiceUseCase(),
    },
  ],
})
export class InvoiceModule {}
