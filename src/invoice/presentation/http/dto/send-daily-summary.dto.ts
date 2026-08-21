import { IsDateString, IsInt, IsPositive, IsString } from 'class-validator';

/** HTTP input for the daily boleta summary. */
export class SendDailySummaryDto {
  @IsString()
  issuerRuc!: string;

  @IsDateString()
  referenceDate!: string;

  @IsInt()
  @IsPositive()
  summaryCorrelative!: number;
}
