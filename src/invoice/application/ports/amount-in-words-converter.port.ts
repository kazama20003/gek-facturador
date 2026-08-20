import { Money } from '../../domain/value-objects/money';

/** Port: renders a monetary amount as its legal Spanish legend (SUNAT catalog 52, code 1000). */
export interface AmountInWordsConverter {
  convert(amount: Money): string;
}

export const AMOUNT_IN_WORDS_CONVERTER = Symbol('AmountInWordsConverter');
