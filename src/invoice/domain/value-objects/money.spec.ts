import {
  CurrencyMismatchError,
  InvalidMoneyError,
} from '../errors/invoice-errors';
import { Currency } from './currency';
import { Money } from './money';
import { Quantity } from './quantity';

describe('Money', () => {
  it('creates from a decimal string and formats with two decimals', () => {
    expect(Money.pen('100').toFixed()).toBe('100.00');
    expect(Money.usd('99.5').toFixed()).toBe('99.50');
    expect(Money.pen('100.00').currency).toBe(Currency.PEN);
  });

  it('rejects negative amounts', () => {
    expect(() => Money.pen('-1')).toThrow(InvalidMoneyError);
  });

  it('rejects non-numeric input', () => {
    expect(() => Money.pen('abc')).toThrow(InvalidMoneyError);
  });

  it('adds amounts of the same currency', () => {
    expect(Money.pen('100.00').add(Money.pen('18.00')).toFixed()).toBe(
      '118.00',
    );
  });

  it('rejects adding different currencies', () => {
    expect(() => Money.pen('1').add(Money.usd('1'))).toThrow(
      CurrencyMismatchError,
    );
  });

  it('subtracts and rejects negative results', () => {
    expect(Money.pen('10').subtract(Money.pen('4')).toFixed()).toBe('6.00');
    expect(() => Money.pen('4').subtract(Money.pen('10'))).toThrow(
      InvalidMoneyError,
    );
  });

  it('multiplies by a quantity', () => {
    expect(Money.pen('100.00').multiplyBy(Quantity.create('2')).toFixed()).toBe(
      '200.00',
    );
  });

  it('rounds half-up to two decimals', () => {
    // 33.335 * 1 -> stays; 10.005 rounds up to 10.01
    expect(Money.pen('10.005').toFixed()).toBe('10.01');
    expect(Money.pen('33.33').multiplyBy('0.18').toFixed()).toBe('6.00'); // 5.9994 -> 6.00
    expect(Money.pen('0.10').multiplyBy('0.18').toFixed()).toBe('0.02'); // 0.018 -> 0.02
  });

  it('compares by value and currency', () => {
    expect(Money.pen('5.00').equals(Money.pen('5'))).toBe(true);
    expect(Money.pen('5.00').equals(Money.usd('5.00'))).toBe(false);
  });
});
