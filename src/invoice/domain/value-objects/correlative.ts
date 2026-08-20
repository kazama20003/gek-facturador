import { InvalidCorrelativeError } from '../errors/invoice-errors';

/** Sequential invoice number within a series: positive integer. */
export class Correlative {
  private constructor(private readonly value: number) {}

  static create(value: number): Correlative {
    if (!Number.isInteger(value) || value <= 0) {
      throw new InvalidCorrelativeError(
        `Correlative must be a positive integer: ${value}.`,
      );
    }
    return new Correlative(value);
  }

  toNumber(): number {
    return this.value;
  }
}
