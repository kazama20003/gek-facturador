import { DominioException } from '../../../../shared/domain/dominio.exception';
import { Dinero } from '../value-objects/dinero.value-object';

/** Línea de un comprobante. El importe se deriva: cantidad * precioUnitario. */
export class ComprobanteDetalle {
  private constructor(
    private readonly _descripcion: string,
    private readonly _cantidad: number,
    private readonly _precioUnitario: Dinero,
    private readonly _importe: Dinero,
    private readonly _id?: string,
  ) {}

  static crear(params: {
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    id?: string;
  }): ComprobanteDetalle {
    const descripcion = params.descripcion?.trim() ?? '';
    if (descripcion.length === 0) {
      throw new DominioException('La descripción del detalle es obligatoria.');
    }
    if (!(params.cantidad > 0)) {
      throw new DominioException(`Cantidad inválida en "${descripcion}": debe ser mayor a 0.`);
    }
    const precioUnitario = Dinero.crear(params.precioUnitario);
    const importe = precioUnitario.multiplicar(params.cantidad);
    return new ComprobanteDetalle(descripcion, params.cantidad, precioUnitario, importe, params.id);
  }

  get id(): string | undefined {
    return this._id;
  }
  get descripcion(): string {
    return this._descripcion;
  }
  get cantidad(): number {
    return this._cantidad;
  }
  get precioUnitario(): Dinero {
    return this._precioUnitario;
  }
  get importe(): Dinero {
    return this._importe;
  }
}
