import { Money } from './money';
import { Detraction } from './detraction';
import { InvalidInvoiceItemError } from '../errors/invoice-errors';

describe('Detraction', () => {
  it('computes the amount as round(total × percent) to whole soles', () => {
    const d = Detraction.create({
      code: '027',
      percent: '4',
      account: '00-000-000000',
      total: Money.pen('1180.00'),
    });
    expect(d.code).toBe('027');
    expect(d.amount.toFixed()).toBe('47.00'); // 1180 * 4% = 47.2 -> 47
  });

  it('rejects a non-3-digit code and a missing account', () => {
    expect(() =>
      Detraction.create({
        code: '27',
        percent: '4',
        account: 'x',
        total: Money.pen('100.00'),
      }),
    ).toThrow(InvalidInvoiceItemError);
    expect(() =>
      Detraction.create({
        code: '027',
        percent: '4',
        account: '',
        total: Money.pen('100.00'),
      }),
    ).toThrow(InvalidInvoiceItemError);
  });
});
