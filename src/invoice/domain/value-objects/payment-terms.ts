import { InvalidPaymentTermsError } from '../errors/invoice-errors';
import { Money } from './money';

/** A single credit installment (cuota) with its due date. */
export class Installment {
  private constructor(
    readonly number: number,
    readonly amount: Money,
    readonly dueDate: Date,
  ) {}

  static create(params: {
    number: number;
    amount: Money;
    dueDate: Date;
  }): Installment {
    if (!Number.isInteger(params.number) || params.number <= 0) {
      throw new InvalidPaymentTermsError(
        `Installment number must be positive: ${params.number}.`,
      );
    }
    return new Installment(params.number, params.amount, params.dueDate);
  }

  /** SUNAT id, e.g. "Cuota001". */
  get id(): string {
    return `Cuota${String(this.number).padStart(3, '0')}`;
  }
}

/**
 * Payment terms of the invoice. Cash (Contado) or credit (Credito) with
 * a pending total and one or more installments whose amounts must add up
 * to that total (invariant checked here, in the domain).
 */
export class PaymentTerms {
  private constructor(
    readonly isCredit: boolean,
    private readonly _pendingAmount: Money | undefined,
    private readonly _installments: Installment[],
  ) {}

  static cash(): PaymentTerms {
    return new PaymentTerms(false, undefined, []);
  }

  static credit(params: {
    pendingAmount: Money;
    installments: Installment[];
  }): PaymentTerms {
    if (params.installments.length === 0) {
      throw new InvalidPaymentTermsError(
        'Credit terms require at least one installment.',
      );
    }
    const sum = params.installments.reduce(
      (acc, i) => acc.add(i.amount),
      Money.zero(params.pendingAmount.currency),
    );
    if (sum.toFixed() !== params.pendingAmount.toFixed()) {
      throw new InvalidPaymentTermsError(
        `Installments (${sum.toFixed()}) must add up to the pending amount (${params.pendingAmount.toFixed()}).`,
      );
    }
    return new PaymentTerms(true, params.pendingAmount, [
      ...params.installments,
    ]);
  }

  get pendingAmount(): Money | undefined {
    return this._pendingAmount;
  }

  get installments(): readonly Installment[] {
    return this._installments;
  }
}
