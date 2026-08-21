import Decimal from 'decimal.js';
import { InvalidInvoiceItemError } from '../errors/invoice-errors';
import { Money } from './money';

/**
 * SPOT detraction (detracción) on the invoice. SUNAT catalog 54 holds the
 * goods/service code (e.g. 027 = transporte de carga). The deposited amount is
 * total × percent, rounded to whole soles (SUNAT rule).
 */
export class Detraction {
  private constructor(
    /** SUNAT catalog 54 code, e.g. '027'. */
    readonly code: string,
    /** Percentage as a plain number string, e.g. '4' or '12'. */
    readonly percent: string,
    /** Banco de la Nación account number. */
    readonly account: string,
    readonly amount: Money,
    /** SUNAT catalog 51 operation type (e.g. 1001 generic, 1004 carga). */
    readonly operationType: string,
  ) {}

  static create(params: {
    code: string;
    percent: string;
    account: string;
    total: Money;
    operationType?: string;
  }): Detraction {
    if (!/^\d{3}$/.test(params.code)) {
      throw new InvalidInvoiceItemError(
        `Detraction code must be 3 digits (catalog 54): "${params.code}".`,
      );
    }
    const percent = new Decimal(params.percent);
    if (!percent.isPositive()) {
      throw new InvalidInvoiceItemError(
        `Detraction percent must be positive: "${params.percent}".`,
      );
    }
    if ((params.account?.trim() ?? '').length === 0) {
      throw new InvalidInvoiceItemError(
        'Detraction requires a Banco de la Nación account.',
      );
    }
    // Amount = round(total × percent%) to whole soles.
    const raw = new Decimal(params.total.toFixed()).times(percent).div(100);
    const rounded = raw.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    const amount = Money.create(rounded.toFixed(2), params.total.currency);
    const operationType = params.operationType ?? '1001';
    if (!/^\d{4}$/.test(operationType)) {
      throw new InvalidInvoiceItemError(
        `Detraction operation type must be 4 digits (catalog 51): "${operationType}".`,
      );
    }
    return new Detraction(
      params.code,
      params.percent,
      params.account.trim(),
      amount,
      operationType,
    );
  }
}
