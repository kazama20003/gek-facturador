import { Inject, Injectable } from '@nestjs/common';
import { Comprobante } from '../../domain/entities/comprobante.entity';
import { ComprobanteDetalle } from '../../domain/entities/comprobante-detalle.entity';
import { COMPROBANTE_REPOSITORY } from '../../domain/repositories/comprobante.repository';
import type { ComprobanteRepository } from '../../domain/repositories/comprobante.repository';
import { Ruc } from '../../domain/value-objects/ruc.value-object';
import { Serie } from '../../domain/value-objects/serie.value-object';
import { CrearComprobanteCommand } from './crear-comprobante.command';

/**
 * Caso de uso: emitir un comprobante electrónico.
 * Responsabilidad única — orquesta dominio + repositorio, sin lógica de negocio propia.
 */
@Injectable()
export class CrearComprobanteUseCase {
  constructor(
    @Inject(COMPROBANTE_REPOSITORY)
    private readonly comprobantes: ComprobanteRepository,
  ) {}

  async ejecutar(comando: CrearComprobanteCommand): Promise<Comprobante> {
    const serie = Serie.crear(comando.serie);
    const rucEmisor = Ruc.crear(comando.rucEmisor);

    const detalles = comando.detalles.map((d) =>
      ComprobanteDetalle.crear({
        descripcion: d.descripcion,
        cantidad: d.cantidad,
        precioUnitario: d.precioUnitario,
      }),
    );

    const correlativo = await this.comprobantes.siguienteCorrelativo(serie.valorPrimitivo());

    const comprobante = Comprobante.emitir({
      tipo: comando.tipo,
      serie,
      correlativo,
      fechaEmision: new Date(),
      moneda: comando.moneda,
      rucEmisor,
      docReceptor: comando.docReceptor,
      nombreReceptor: comando.nombreReceptor,
      detalles,
    });

    return this.comprobantes.guardar(comprobante);
  }
}
