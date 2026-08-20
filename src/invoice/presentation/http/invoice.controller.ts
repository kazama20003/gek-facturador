import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  CreateInvoiceUseCase,
  type CreateInvoiceResult,
} from '../../application/use-cases/create-invoice.use-case';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

/** HTTP adapter — translates the DTO to a command; no business logic here. */
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly createInvoice: CreateInvoiceUseCase) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateInvoiceDto): CreateInvoiceResult {
    return this.createInvoice.execute(dto);
  }
}
