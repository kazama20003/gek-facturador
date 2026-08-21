import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import {
  SendDailySummaryUseCase,
  type SendDailySummaryResult,
} from '../../application/use-cases/send-daily-summary.use-case';
import { SendDailySummaryDto } from './dto/send-daily-summary.dto';

/** Daily boleta summary (Resumen Diario). Development endpoint — not a public API. */
@Controller('summaries')
export class SummaryController {
  constructor(
    @Inject(SendDailySummaryUseCase)
    private readonly sendDailySummary: SendDailySummaryUseCase,
  ) {}

  @Post('daily')
  @HttpCode(HttpStatus.CREATED)
  send(@Body() dto: SendDailySummaryDto): Promise<SendDailySummaryResult> {
    return this.sendDailySummary.execute(dto);
  }
}
