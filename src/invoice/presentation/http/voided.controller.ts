import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import {
  VoidInvoicesUseCase,
  type VoidInvoicesResult,
} from '../../application/use-cases/void-invoices.use-case';
import { VoidInvoicesDto } from './dto/void-invoices.dto';

/** Comunicación de Baja (RA). Development endpoint — not a public API. */
@Controller('voided-documents')
export class VoidedController {
  constructor(
    @Inject(VoidInvoicesUseCase)
    private readonly voidInvoices: VoidInvoicesUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  send(@Body() dto: VoidInvoicesDto): Promise<VoidInvoicesResult> {
    return this.voidInvoices.execute(dto);
  }
}
