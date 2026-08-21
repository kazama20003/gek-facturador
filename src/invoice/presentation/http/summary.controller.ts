import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import {
  SendDailySummaryUseCase,
  type SendDailySummaryResult,
} from '../../application/use-cases/send-daily-summary.use-case';
import {
  SUBMISSION_REPOSITORY,
  type SubmissionRecord,
  type SubmissionRepository,
} from '../../application/ports/submission-repository.port';
import { SendDailySummaryDto } from './dto/send-daily-summary.dto';

/** Daily boleta summary (Resumen Diario). Development endpoint — not a public API. */
@Controller('summaries')
export class SummaryController {
  constructor(
    @Inject(SendDailySummaryUseCase)
    private readonly sendDailySummary: SendDailySummaryUseCase,
    @Inject(SUBMISSION_REPOSITORY)
    private readonly submissions: SubmissionRepository,
  ) {}

  @Post('daily')
  @HttpCode(HttpStatus.CREATED)
  send(@Body() dto: SendDailySummaryDto): Promise<SendDailySummaryResult> {
    return this.sendDailySummary.execute(dto);
  }

  /** Looks up a stored RC/RA submission by its document id (e.g. RC-20260820-1). */
  @Get('submissions/:documentId')
  async findSubmission(
    @Param('documentId') documentId: string,
  ): Promise<SubmissionRecord> {
    const record = await this.submissions.findByDocumentId(documentId);
    if (!record) {
      throw new NotFoundException(`Submission ${documentId} not found.`);
    }
    return record;
  }
}
