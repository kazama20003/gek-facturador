import { DominioException } from '../../../../shared/domain/dominio.exception';

/**
 * RUC — Registro Único de Contribuyentes (Perú): 11 dígitos.
 * Value Object inmutable; se valida al construir.
 */
export class Ruc {
  private constructor(private readonly valor: string) {}

  static crear(valor: string): Ruc {
    const limpio = valor?.trim() ?? '';
    if (!/^\d{11}$/.test(limpio)) {
      throw new DominioException(`RUC inválido: "${valor}". Debe tener 11 dígitos.`);
    }
    return new Ruc(limpio);
  }

  valorPrimitivo(): string {
    return this.valor;
  }

  esIgual(otro: Ruc): boolean {
    return this.valor === otro.valor;
  }
}
