import { Money } from '../../domain/value-objects/money';
import { SpanishAmountInWordsConverter } from './spanish-amount-in-words.converter';

describe('SpanishAmountInWordsConverter', () => {
  const converter = new SpanishAmountInWordsConverter();

  it.each([
    ['118.00', 'CIENTO DIECIOCHO CON 00/100 SOLES'],
    ['0.00', 'CERO CON 00/100 SOLES'],
    ['1.50', 'UNO CON 50/100 SOLES'],
    ['16.00', 'DIECISEIS CON 00/100 SOLES'],
    ['21.05', 'VEINTIUNO CON 05/100 SOLES'],
    ['100.00', 'CIEN CON 00/100 SOLES'],
    ['101.00', 'CIENTO UNO CON 00/100 SOLES'],
    ['555.55', 'QUINIENTOS CINCUENTA Y CINCO CON 55/100 SOLES'],
    ['1000.00', 'MIL CON 00/100 SOLES'],
    ['21000.00', 'VEINTIUN MIL CON 00/100 SOLES'],
    ['1000000.00', 'UN MILLON CON 00/100 SOLES'],
    ['2500001.10', 'DOS MILLONES QUINIENTOS MIL UNO CON 10/100 SOLES'],
  ])('converts S/%s to "%s"', (amount, expected) => {
    expect(converter.convert(Money.pen(amount))).toBe(expected);
  });

  it('uses the USD currency name', () => {
    expect(converter.convert(Money.usd('118.00'))).toBe(
      'CIENTO DIECIOCHO CON 00/100 DOLARES AMERICANOS',
    );
  });
});
