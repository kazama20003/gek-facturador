import { DominioException } from '../../../../shared/domain/dominio.exception';

/**
 * Dinero — monto con 2 decimales, no negativo.
 * Se trabaja en céntimos internamente para evitar errores de coma flotante.
 */
export class Dinero {
  private constructor(private readonly centimos: number) {}

  static crear(monto: number): Dinero {
    if (typeof monto !== 'number' || Number.isNaN(monto)) {
      throw new DominioException(`Monto inválido: "${monto}".`);
    }
    if (monto < 0) {
      throw new DominioException(`El monto no puede ser negativo: ${monto}.`);
    }
    return new Dinero(Math.round(monto * 100));
  }

  static cero(): Dinero {
    return new Dinero(0);
  }

  sumar(otro: Dinero): Dinero {
    return new Dinero(this.centimos + otro.centimos);
  }

  multiplicar(factor: number): Dinero {
    return new Dinero(Math.round(this.centimos * factor));
  }

  aplicarPorcentaje(porcentaje: number): Dinero {
    return new Dinero(Math.round(this.centimos * (porcentaje / 100)));
  }

  valorPrimitivo(): number {
    return this.centimos / 100;
  }
}
