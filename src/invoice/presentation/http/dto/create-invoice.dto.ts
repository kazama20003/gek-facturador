import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';

const DECIMAL_STRING = /^\d+(\.\d+)?$/;

export class PartyDto {
  @IsString()
  ruc!: string;

  @IsString()
  @MinLength(1)
  businessName!: string;
}

export class AddressDto {
  @IsString()
  ubigeo!: string;

  @IsString()
  @MinLength(1)
  department!: string;

  @IsString()
  @MinLength(1)
  province!: string;

  @IsString()
  @MinLength(1)
  district!: string;

  @IsString()
  @MinLength(1)
  addressLine!: string;
}

export class IssuerDto extends PartyDto {
  @IsOptional()
  @IsString()
  tradeName?: string;

  @IsOptional()
  @IsDefined()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}

export class CreateInvoiceItemDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsString()
  @MinLength(1)
  unitCode!: string;

  @Matches(DECIMAL_STRING, {
    message: 'quantity must be a decimal string, e.g. "2" or "2.5"',
  })
  quantity!: string;

  @Matches(DECIMAL_STRING, {
    message: 'unitValue must be a decimal string, e.g. "100.00"',
  })
  unitValue!: string;
}

/** HTTP input shape only — tax rules and calculations live in the domain. */
export class CreateInvoiceDto {
  @IsString()
  series!: string;

  @IsInt()
  @IsPositive()
  correlative!: number;

  @IsDateString()
  issueDate!: string;

  @IsIn(['PEN', 'USD'])
  currency!: 'PEN' | 'USD';

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
