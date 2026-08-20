import Decimal from 'decimal.js';
import { InvalidQuantityError } from '../errors/invoice-errors';

/** Positive decimal quantity (supports fractional units, e.g. "2.5"). */
export class Quantity {
  private constructor(private readonly value: Decimal) {}

  static create(value: string): Quantity {
    let parsed: Decimal;
    try {
      parsed = new Decimal(value);
    } catch {
      throw new InvalidQuantityError(`Invalid quantity: "${value}".`);
    }
    if (!parsed.isPositive() || parsed.isZero()) {
      throw new InvalidQuantityError(
        `Quantity must be greater than zero: "${value}".`,
      );
    }
    return new Quantity(parsed);
  }

  toString(): string {
    return this.value.toString();
  }
}
