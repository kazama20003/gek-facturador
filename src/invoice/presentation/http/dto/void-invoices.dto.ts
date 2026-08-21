import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsPositive,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class VoidDocumentDto {
  @IsString()
  @MinLength(1)
  invoiceId!: string;

  @IsString()
  @MinLength(1)
  reason!: string;
}

/** HTTP input for the voided-documents communication (RA). */
export class VoidInvoicesDto {
  @IsInt()
  @IsPositive()
  voidCorrelative!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VoidDocumentDto)
  documents!: VoidDocumentDto[];
}
