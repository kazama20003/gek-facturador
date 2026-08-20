import { InvalidRucError } from '../errors/invoice-errors';

/** Weights defined by SUNAT's modulus-11 check-digit algorithm. */
const CHECK_DIGIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

/** Peruvian taxpayer registry number (RUC): 11 digits with a check digit. */
export class Ruc {
  private constructor(private readonly value: string) {}

  static create(value: string): Ruc {
    const trimmed = value?.trim() ?? '';
    if (!/^\d{11}$/.test(trimmed)) {
      throw new InvalidRucError(`RUC must be exactly 11 digits: "${value}".`);
    }
    if (!Ruc.hasValidCheckDigit(trimmed)) {
      throw new InvalidRucError(`RUC has an invalid check digit: "${value}".`);
    }
    return new Ruc(trimmed);
  }

  private static hasValidCheckDigit(ruc: string): boolean {
    const sum = CHECK_DIGIT_WEIGHTS.reduce(
      (acc, weight, index) => acc + weight * Number(ruc[index]),
      0,
    );
    const checkDigit = (11 - (sum % 11)) % 10;
    return checkDigit === Number(ruc[10]);
  }

  equals(other: Ruc): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
