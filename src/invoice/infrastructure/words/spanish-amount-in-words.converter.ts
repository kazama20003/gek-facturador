import type { AmountInWordsConverter } from '../../application/ports/amount-in-words-converter.port';
import { Currency } from '../../domain/value-objects/currency';
import { Money } from '../../domain/value-objects/money';

const UNITS = [
  'CERO',
  'UNO',
  'DOS',
  'TRES',
  'CUATRO',
  'CINCO',
  'SEIS',
  'SIETE',
  'OCHO',
  'NUEVE',
  'DIEZ',
  'ONCE',
  'DOCE',
  'TRECE',
  'CATORCE',
  'QUINCE',
  'DIECISEIS',
  'DIECISIETE',
  'DIECIOCHO',
  'DIECINUEVE',
  'VEINTE',
  'VEINTIUNO',
  'VEINTIDOS',
  'VEINTITRES',
  'VEINTICUATRO',
  'VEINTICINCO',
  'VEINTISEIS',
  'VEINTISIETE',
  'VEINTIOCHO',
  'VEINTINUEVE',
];

const TENS = [
  '',
  '',
  '',
  'TREINTA',
  'CUARENTA',
  'CINCUENTA',
  'SESENTA',
  'SETENTA',
  'OCHENTA',
  'NOVENTA',
];

const HUNDREDS = [
  '',
  'CIENTO',
  'DOSCIENTOS',
  'TRESCIENTOS',
  'CUATROCIENTOS',
  'QUINIENTOS',
  'SEISCIENTOS',
  'SETECIENTOS',
  'OCHOCIENTOS',
  'NOVECIENTOS',
];

/** SUNAT legend currency names (uppercase, unaccented — usual practice in CPE legends). */
const CURRENCY_NAMES: Record<Currency, string> = {
  [Currency.PEN]: 'SOLES',
  [Currency.USD]: 'DOLARES AMERICANOS',
};

function belowThousand(n: number): string {
  if (n < 30) return UNITS[n];
  if (n < 100) {
    const tens = TENS[Math.floor(n / 10)];
    const unit = n % 10;
    return unit === 0 ? tens : `${tens} Y ${UNITS[unit]}`;
  }
  if (n === 100) return 'CIEN';
  const rest = n % 100;
  return rest === 0
    ? HUNDREDS[Math.floor(n / 100)]
    : `${HUNDREDS[Math.floor(n / 100)]} ${belowThousand(rest)}`;
}

/** "UNO"/"VEINTIUNO" apocopate to "UN"/"VEINTIUN" before MIL / MILLON. */
function apocopate(words: string): string {
  return words.replace(/UNO$/, 'UN');
}

function integerToWords(n: number): string {
  if (n === 0) return 'CERO';
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  if (millions > 0) {
    parts.push(
      millions === 1
        ? 'UN MILLON'
        : `${apocopate(belowThousand(millions))} MILLONES`,
    );
  }
  if (thousands > 0) {
    parts.push(
      thousands === 1 ? 'MIL' : `${apocopate(belowThousand(thousands))} MIL`,
    );
  }
  if (rest > 0) {
    parts.push(belowThousand(rest));
  }
  return parts.join(' ');
}

/**
 * Renders the legal amount legend, e.g. "CIENTO DIECIOCHO CON 00/100 SOLES"
 * (SUNAT catalog 52, code 1000). Supports amounts below one billion.
 */
export class SpanishAmountInWordsConverter implements AmountInWordsConverter {
  convert(amount: Money): string {
    const [integerPart, cents] = amount.toFixed().split('.');
    const words = integerToWords(Number(integerPart));
    return `${words} CON ${cents}/100 ${CURRENCY_NAMES[amount.currency]}`;
  }
}
