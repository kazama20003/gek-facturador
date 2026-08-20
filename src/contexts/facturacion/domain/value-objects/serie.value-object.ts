import { DominioException } from '../../../../shared/domain/dominio.exception';

/**
 * Serie del comprobante. Factura empieza con 'F', boleta con 'B',
 * seguido de 3 caracteres alfanuméricos (ej. F001, B001).
 */
export class Serie {
  private constructor(private readonly valor: string) {}

  static crear(valor: string): Serie {
    const limpio = valor?.trim().toUpperCase() ?? '';
    if (!/^[FB][A-Z0-9]{3}$/.test(limpio)) {
      throw new DominioException(`Serie inválida: "${valor}". Formato esperado: F001 / B001.`);
    }
    return new Serie(limpio);
  }

  valorPrimitivo(): string {
    return this.valor;
  }
}
