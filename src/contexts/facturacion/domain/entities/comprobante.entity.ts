import { DominioException } from '../../../../shared/domain/dominio.exception';
import { EstadoComprobante } from '../enums/estado-comprobante.enum';
import { Moneda } from '../enums/moneda.enum';
import { TipoComprobante } from '../enums/tipo-comprobante.enum';
import { Dinero } from '../value-objects/dinero.value-object';
import { Ruc } from '../value-objects/ruc.value-object';
import { Serie } from '../value-objects/serie.value-object';
import { ComprobanteDetalle } from './comprobante-detalle.entity';

/** IGV vigente en Perú. */
const PORCENTAJE_IGV = 18;

interface PropsComprobante {
  id?: string;
  tipo: TipoComprobante;
  serie: Serie;
  correlativo: number;
  fechaEmision: Date;
  moneda: Moneda;
  rucEmisor: Ruc;
  docReceptor: string;
  nombreReceptor: string;
  detalles: ComprobanteDetalle[];
  estado: EstadoComprobante;
}

/**
 * Comprobante — raíz de agregado. Garantiza sus invariantes:
 * tiene al menos un detalle y los totales siempre cuadran con las líneas.
 */
export class Comprobante {
  private constructor(private props: PropsComprobante) {}

  /** Emite un comprobante nuevo (estado inicial PENDIENTE). */
  static emitir(params: {
    tipo: TipoComprobante;
    serie: Serie;
    correlativo: number;
    fechaEmision: Date;
    moneda: Moneda;
    rucEmisor: Ruc;
    docReceptor: string;
    nombreReceptor: string;
    detalles: ComprobanteDetalle[];
  }): Comprobante {
    if (params.detalles.length === 0) {
      throw new DominioException('El comprobante debe tener al menos un detalle.');
    }
    if (!Number.isInteger(params.correlativo) || params.correlativo <= 0) {
      throw new DominioException(`Correlativo inválido: ${params.correlativo}.`);
    }
    if ((params.nombreReceptor?.trim() ?? '').length === 0) {
      throw new DominioException('El nombre del receptor es obligatorio.');
    }
    return new Comprobante({ ...params, estado: EstadoComprobante.Pendiente });
  }

  /** Reconstituye desde persistencia sin re-validar reglas de emisión. */
  static reconstituir(props: PropsComprobante): Comprobante {
    return new Comprobante(props);
  }

  /** Suma de los importes de las líneas (base imponible). */
  get subtotal(): Dinero {
    return this.props.detalles.reduce((acc, d) => acc.sumar(d.importe), Dinero.cero());
  }

  get igv(): Dinero {
    return this.subtotal.aplicarPorcentaje(PORCENTAJE_IGV);
  }

  get total(): Dinero {
    return this.subtotal.sumar(this.igv);
  }

  /** Marca aceptación por SUNAT. Solo válido desde PENDIENTE. */
  aceptar(): void {
    if (this.props.estado !== EstadoComprobante.Pendiente) {
      throw new DominioException(
        `No se puede aceptar un comprobante en estado ${this.props.estado}.`,
      );
    }
    this.props.estado = EstadoComprobante.Aceptado;
  }

  anular(): void {
    if (this.props.estado === EstadoComprobante.Anulado) {
      throw new DominioException('El comprobante ya está anulado.');
    }
    this.props.estado = EstadoComprobante.Anulado;
  }

  get id(): string | undefined {
    return this.props.id;
  }
  get tipo(): TipoComprobante {
    return this.props.tipo;
  }
  get serie(): Serie {
    return this.props.serie;
  }
  get correlativo(): number {
    return this.props.correlativo;
  }
  get fechaEmision(): Date {
    return this.props.fechaEmision;
  }
  get moneda(): Moneda {
    return this.props.moneda;
  }
  get rucEmisor(): Ruc {
    return this.props.rucEmisor;
  }
  get docReceptor(): string {
    return this.props.docReceptor;
  }
  get nombreReceptor(): string {
    return this.props.nombreReceptor;
  }
  get detalles(): readonly ComprobanteDetalle[] {
    return this.props.detalles;
  }
  get estado(): EstadoComprobante {
    return this.props.estado;
  }
}
