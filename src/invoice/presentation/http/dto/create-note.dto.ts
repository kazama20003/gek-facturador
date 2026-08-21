import { Type } from 'class-transformer';
import {
  IsDefined,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  CreateInvoiceItemDto,
  IssuerDto,
  PartyDto,
} from './create-invoice.dto';

export class ModifiedDocumentDto {
  @IsOptional()
  @IsIn(['01', '03'])
  documentType?: '01' | '03';

  @IsString()
  series!: string;

  @IsInt()
  @IsPositive()
  correlative!: number;
}

/** HTTP input for credit/debit notes. Tax rules live in the domain. */
export class CreateNoteDto {
  @IsString()
  series!: string;

  @IsInt()
  @IsPositive()
  correlative!: number;

  @IsDateString()
  issueDate!: string;

  @IsIn(['PEN', 'USD'])
  currency!: 'PEN' | 'USD';

  @IsString()
  @MinLength(1)
  reasonCode!: string;

  @IsOptional()
  @IsString()
  reasonDescription?: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => ModifiedDocumentDto)
  modifies!: ModifiedDocumentDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => IssuerDto)
  issuer!: IssuerDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => PartyDto)
  customer!: PartyDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items!: CreateInvoiceItemDto[];
}
