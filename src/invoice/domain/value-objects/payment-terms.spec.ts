import { InvalidPaymentTermsError } from '../errors/invoice-errors';
import { Money } from './money';
import { Installment, PaymentTerms } from './payment-terms';

function cuota(n: number, amount: string, day: string): Installment {
  return Installment.create({
    number: n,
    amount: Money.pen(amount),
    dueDate: new Date(`2026-09-${day}`),
  });
}

describe('PaymentTerms', () => {
  it('cash has no installments', () => {
    const terms = PaymentTerms.cash();
    expect(terms.isCredit).toBe(false);
    expect(terms.installments).toHaveLength(0);
    expect(terms.pendingAmount).toBeUndefined();
  });

  it('credit requires installments that add up to the pending amount', () => {
    const terms = PaymentTerms.credit({
      pendingAmount: Money.pen('118.00'),
      installments: [cuota(1, '60.00', '15'), cuota(2, '58.00', '30')],
    });
    expect(terms.isCredit).toBe(true);
    expect(terms.installments.map((i) => i.id)).toEqual([
      'Cuota001',
      'Cuota002',
    ]);
    expect(terms.pendingAmount?.toFixed()).toBe('118.00');
  });

  it('rejects installments that do not sum to the pending amount', () => {
    expect(() =>
      PaymentTerms.credit({
        pendingAmount: Money.pen('118.00'),
        installments: [cuota(1, '60.00', '15'), cuota(2, '50.00', '30')],
      }),
    ).toThrow(InvalidPaymentTermsError);
  });

  it('rejects credit with no installments', () => {
    expect(() =>
      PaymentTerms.credit({
        pendingAmount: Money.pen('1.00'),
        installments: [],
      }),
    ).toThrow(InvalidPaymentTermsError);
  });
});
