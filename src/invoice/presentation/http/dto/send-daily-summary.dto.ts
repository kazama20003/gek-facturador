import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

/** HTTP input for the daily boleta summary. */
export class SendDailySummaryDto {
  @IsString()
  issuerRuc!: string;

  @IsDateString()
  referenceDate!: string;

  @IsInt()
  @IsPositive()
  summaryCorrelative!: number;

  /** When present, the summary voids these boletas (ConditionCode 3). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  voidBoletaIds?: string[];
}
