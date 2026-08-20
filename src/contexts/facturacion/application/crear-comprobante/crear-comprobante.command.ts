import { Moneda } from '../../domain/enums/moneda.enum';
import { TipoComprobante } from '../../domain/enums/tipo-comprobante.enum';

/** Datos de entrada del caso de uso (independiente de HTTP). */
export interface CrearComprobanteCommand {
  tipo: TipoComprobante;
  serie: string;
  moneda: Moneda;
  rucEmisor: string;
  docReceptor: string;
  nombreReceptor: string;
  detalles: Array<{
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
  }>;
}
