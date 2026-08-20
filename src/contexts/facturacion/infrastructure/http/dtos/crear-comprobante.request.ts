import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsPositive,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Moneda } from '../../../domain/enums/moneda.enum';
import { TipoComprobante } from '../../../domain/enums/tipo-comprobante.enum';

class DetalleRequest {
  @IsString()
  @MinLength(1)
  descripcion!: string;

  @IsNumber()
  @IsPositive()
  cantidad!: number;

  @IsNumber()
  @IsPositive()
  precioUnitario!: number;
}

/** Contrato HTTP de entrada. La validación de formato vive aquí; las reglas de negocio, en el dominio. */
export class CrearComprobanteRequest {
  @IsEnum(TipoComprobante)
  tipo!: TipoComprobante;

  @IsString()
  serie!: string;

  @IsEnum(Moneda)
  moneda!: Moneda;

  @IsString()
  rucEmisor!: string;

  @IsString()
  docReceptor!: string;

  @IsString()
  @MinLength(1)
  nombreReceptor!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DetalleRequest)
  detalles!: DetalleRequest[];
}
