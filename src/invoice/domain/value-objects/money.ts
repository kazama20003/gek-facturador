import Decimal from 'decimal.js';
import {
  CurrencyMismatchError,
  InvalidMoneyError,
} from '../errors/invoice-errors';
import { Currency } from './currency';
import { Quantity } from './quantity';

/**
 * Immutable monetary amount backed by Decimal to avoid floating-point drift.
 * Amounts are non-negative and rounded HALF-UP to 2 decimal places, the
 * rounding rule used for SUNAT electronic invoicing totals.
 */
export class Money {
  private constructor(
    private readonly amount: Decimal,
    readonly currency: Currency,
  ) {}

  static create(amount: string, currency: Currency): Money {
    let parsed: Decimal;
    try {
      parsed = new Decimal(amount);
    } catch {
      throw new InvalidMoneyError(`Invalid monetary amount: "${amount}".`);
    }
    if (parsed.isNegative()) {
      throw new InvalidMoneyError(
        `Monetary amounts cannot be negative: "${amount}".`,
      );
    }
    return new Money(Money.round(parsed), currency);
  }

  static pen(amount: string): Money {
    return Money.create(amount, Currency.PEN);
  }

  static usd(amount: string): Money {
    return Money.create(amount, Currency.USD);
  }

  static zero(currency: Currency): Money {
    return new Money(new Decimal(0), currency);
  }

  private static round(value: Decimal): Decimal {
    return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(
        `Cannot operate on different currencies: ${this.currency} vs ${other.currency}.`,
      );
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(
      Money.round(this.amount.plus(other.amount)),
      this.currency,
    );
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    const result = this.amount.minus(other.amount);
    if (result.isNegative()) {
      throw new InvalidMoneyError(
        'Subtraction would produce a negative amount.',
      );
    }
    return new Money(Money.round(result), this.currency);
  }

  /** Multiplies by a quantity or a plain decimal factor (e.g. an IGV rate). */
  multiplyBy(factor: Quantity | string): Money {
    const value = factor instanceof Quantity ? factor.toString() : factor;
    return new Money(Money.round(this.amount.times(value)), this.currency);
  }

  /** Divides by a quantity or a plain decimal factor. */
  divideBy(factor: Quantity | string): Money {
    const value = factor instanceof Quantity ? factor.toString() : factor;
    return new Money(Money.round(this.amount.div(value)), this.currency);
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amount.equals(other.amount);
  }

  /** Amount formatted with exactly two decimals, e.g. "118.00". */
  toFixed(): string {
    return this.amount.toFixed(2);
  }
}
