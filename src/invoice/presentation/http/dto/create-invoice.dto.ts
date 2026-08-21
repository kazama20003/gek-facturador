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

export class InstallmentDto {
  @Matches(DECIMAL_STRING, { message: 'amount must be a decimal string' })
  amount!: string;

  @IsDateString()
  dueDate!: string;
}

export class CreditTermsDto {
  @Matches(DECIMAL_STRING, {
    message: 'pendingAmount must be a decimal string',
  })
  pendingAmount!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InstallmentDto)
  installments!: InstallmentDto[];
}

export class PartyDto {
  @IsString()
  ruc!: string;

  @IsString()
  @MinLength(1)
  businessName!: string;
}

/** Customer: RUC (invoices) or DNI (boletas). Exactly one must be provided. */
export class CustomerDto {
  @IsOptional()
  @IsString()
  ruc?: string;

  @IsOptional()
  @IsString()
  dni?: string;

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

  @IsOptional()
  @IsIn(['10', '20', '30', '11'])
  igvAffectationCode?: string;

  @IsOptional()
  @Matches(DECIMAL_STRING, { message: 'discount must be a decimal string' })
  discount?: string;
}

export class DetractionDto {
  @Matches(/^\d{3}$/, {
    message: 'detraction code must be 3 digits (catalog 54)',
  })
  code!: string;

  @Matches(DECIMAL_STRING, { message: 'percent must be a decimal string' })
  percent!: string;

  @IsString()
  @MinLength(1)
  account!: string;

  @IsOptional()
  @Matches(/^\d{4}$/, {
    message: 'operationType must be 4 digits (catalog 51)',
  })
  operationType?: string;
}

/** HTTP input shape only — tax rules and calculations live in the domain. */
export class CreateInvoiceDto {
  @IsOptional()
  @IsIn(['01', '03'])
  documentType?: '01' | '03';

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
  @Type(() => CustomerDto)
  customer!: CustomerDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items!: CreateInvoiceItemDto[];

  @IsOptional()
  @Matches(DECIMAL_STRING, {
    message: 'globalDiscount must be a decimal string',
  })
  globalDiscount?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DetractionDto)
  detraction?: DetractionDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreditTermsDto)
  credit?: CreditTermsDto;
}
