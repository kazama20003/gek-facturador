import { DominioException } from '../../../../shared/domain/dominio.exception';
import { EstadoComprobante } from '../enums/estado-comprobante.enum';
import { Moneda } from '../enums/moneda.enum';
import { TipoComprobante } from '../enums/tipo-comprobante.enum';
import { Ruc } from '../value-objects/ruc.value-object';
import { Serie } from '../value-objects/serie.value-object';
import { ComprobanteDetalle } from './comprobante-detalle.entity';
import { Comprobante } from './comprobante.entity';

function detalle(precio: number, cantidad: number) {
  return ComprobanteDetalle.crear({
    descripcion: 'Servicio',
    cantidad,
    precioUnitario: precio,
  });
}

function emitir(detalles: ComprobanteDetalle[]) {
  return Comprobante.emitir({
    tipo: TipoComprobante.Factura,
    serie: Serie.crear('F001'),
    correlativo: 1,
    fechaEmision: new Date(),
    moneda: Moneda.Soles,
    rucEmisor: Ruc.crear('20123456789'),
    docReceptor: '10456789012',
    nombreReceptor: 'Cliente SAC',
    detalles,
  });
}

describe('Comprobante (dominio)', () => {
  it('calcula subtotal, IGV 18% y total desde las líneas', () => {
    const c = emitir([detalle(100, 2), detalle(50, 1)]); // 250 base

    expect(c.subtotal.valorPrimitivo()).toBe(250);
    expect(c.igv.valorPrimitivo()).toBe(45);
    expect(c.total.valorPrimitivo()).toBe(295);
    expect(c.estado).toBe(EstadoComprobante.Pendiente);
  });

  it('rechaza emitir sin detalles', () => {
    expect(() => emitir([])).toThrow(DominioException);
  });

  it('acepta solo desde estado PENDIENTE', () => {
    const c = emitir([detalle(10, 1)]);
    c.aceptar();
    expect(c.estado).toBe(EstadoComprobante.Aceptado);
    expect(() => c.aceptar()).toThrow(DominioException);
  });

  it('valida RUC de 11 dígitos', () => {
    expect(() => Ruc.crear('123')).toThrow(DominioException);
  });

  it('valida formato de serie', () => {
    expect(() => Serie.crear('X999')).toThrow(DominioException);
  });
});
