import type {
  comprobante as ComprobanteRow,
  comprobante_detalle as DetalleRow,
  Prisma,
} from '@prisma/client';
import { Comprobante } from '../../domain/entities/comprobante.entity';
import { ComprobanteDetalle } from '../../domain/entities/comprobante-detalle.entity';
import { EstadoComprobante } from '../../domain/enums/estado-comprobante.enum';
import { Moneda } from '../../domain/enums/moneda.enum';
import { TipoComprobante } from '../../domain/enums/tipo-comprobante.enum';
import { Ruc } from '../../domain/value-objects/ruc.value-object';
import { Serie } from '../../domain/value-objects/serie.value-object';

type FilaConDetalles = ComprobanteRow & { detalles: DetalleRow[] };

/**
 * Traduce entre el modelo de persistencia (Prisma) y el dominio.
 * Aísla al dominio de cualquier detalle de la base de datos.
 */
export class ComprobanteMapper {
  /** Dominio -> fila lista para Prisma (create anidado). */
  static aPersistencia(c: Comprobante): Prisma.comprobanteCreateInput {
    return {
      tipo: c.tipo,
      serie: c.serie.valorPrimitivo(),
      correlativo: c.correlativo,
      fecha_emision: c.fechaEmision,
      moneda: c.moneda,
      ruc_emisor: c.rucEmisor.valorPrimitivo(),
      doc_receptor: c.docReceptor,
      nombre_receptor: c.nombreReceptor,
      subtotal: c.subtotal.valorPrimitivo(),
      igv: c.igv.valorPrimitivo(),
      total: c.total.valorPrimitivo(),
      estado: c.estado,
      detalles: {
        create: c.detalles.map((d) => ({
          descripcion: d.descripcion,
          cantidad: d.cantidad,
          precio_unitario: d.precioUnitario.valorPrimitivo(),
          importe: d.importe.valorPrimitivo(),
        })),
      },
    };
  }

  /** Fila Prisma -> agregado de dominio reconstituido. */
  static aDominio(fila: FilaConDetalles): Comprobante {
    const detalles = fila.detalles.map((d) =>
      ComprobanteDetalle.crear({
        id: d.id,
        descripcion: d.descripcion,
        cantidad: Number(d.cantidad),
        precioUnitario: Number(d.precio_unitario),
      }),
    );

    return Comprobante.reconstituir({
      id: fila.id,
      tipo: fila.tipo as TipoComprobante,
      serie: Serie.crear(fila.serie),
      correlativo: fila.correlativo,
      fechaEmision: fila.fecha_emision,
      moneda: fila.moneda as Moneda,
      rucEmisor: Ruc.crear(fila.ruc_emisor),
      docReceptor: fila.doc_receptor,
      nombreReceptor: fila.nombre_receptor,
      detalles,
      estado: fila.estado as EstadoComprobante,
    });
  }
}
