import { Comprobante } from '../../domain/entities/comprobante.entity';

/** Traduce el agregado de dominio a la respuesta JSON de la API. */
export class ComprobantePresenter {
  static aRespuesta(c: Comprobante) {
    return {
      id: c.id,
      tipo: c.tipo,
      serie: c.serie.valorPrimitivo(),
      correlativo: c.correlativo,
      fechaEmision: c.fechaEmision.toISOString(),
      moneda: c.moneda,
      rucEmisor: c.rucEmisor.valorPrimitivo(),
      docReceptor: c.docReceptor,
      nombreReceptor: c.nombreReceptor,
      subtotal: c.subtotal.valorPrimitivo(),
      igv: c.igv.valorPrimitivo(),
      total: c.total.valorPrimitivo(),
      estado: c.estado,
      detalles: c.detalles.map((d) => ({
        descripcion: d.descripcion,
        cantidad: d.cantidad,
        precioUnitario: d.precioUnitario.valorPrimitivo(),
        importe: d.importe.valorPrimitivo(),
      })),
    };
  }
}
