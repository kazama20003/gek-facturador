import { Comprobante } from '../entities/comprobante.entity';

/**
 * Puerto de persistencia del agregado Comprobante.
 * El dominio define el contrato; la infraestructura lo implementa.
 */
export interface ComprobanteRepository {
  guardar(comprobante: Comprobante): Promise<Comprobante>;
  buscarPorId(id: string): Promise<Comprobante | null>;
  existeSerieCorrelativo(serie: string, correlativo: number): Promise<boolean>;
  siguienteCorrelativo(serie: string): Promise<number>;
}

/** Token de inyección para NestJS (interfaces no existen en runtime). */
export const COMPROBANTE_REPOSITORY = Symbol('ComprobanteRepository');
