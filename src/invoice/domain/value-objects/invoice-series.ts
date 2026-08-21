import { InvalidInvoiceSeriesError } from '../errors/invoice-errors';

/**
 * Series: 4 alphanumeric characters starting with 'F' (invoices) or 'B'
 * (boletas). The Invoice aggregate enforces the pairing with the document type.
 */
export class InvoiceSeries {
  private constructor(private readonly value: string) {}

  static create(value: string): InvoiceSeries {
    const normalized = value?.trim().toUpperCase() ?? '';
    if (!/^[FB][A-Z0-9]{3}$/.test(normalized)) {
      throw new InvalidInvoiceSeriesError(
        `Series must be 4 alphanumeric characters starting with "F" or "B": "${value}".`,
      );
    }
    return new InvoiceSeries(normalized);
  }

  startsWith(letter: 'F' | 'B'): boolean {
    return this.value.startsWith(letter);
  }

  toString(): string {
    return this.value;
  }
}
