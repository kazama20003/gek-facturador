import { Module } from '@nestjs/common';
import { InvoiceModule } from './invoice/invoice.module';

@Module({
  imports: [InvoiceModule],
})
export class AppModule {}
