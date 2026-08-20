import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Comprobante } from '../../domain/entities/comprobante.entity';
import { COMPROBANTE_REPOSITORY } from '../../domain/repositories/comprobante.repository';
import type { ComprobanteRepository } from '../../domain/repositories/comprobante.repository';

/** Caso de uso: obtener un comprobante por su id. */
@Injectable()
export class BuscarComprobanteUseCase {
  constructor(
    @Inject(COMPROBANTE_REPOSITORY)
    private readonly comprobantes: ComprobanteRepository,
  ) {}

  async ejecutar(id: string): Promise<Comprobante> {
    const comprobante = await this.comprobantes.buscarPorId(id);
    if (!comprobante) {
      throw new NotFoundException(`Comprobante ${id} no encontrado.`);
    }
    return comprobante;
  }
}
