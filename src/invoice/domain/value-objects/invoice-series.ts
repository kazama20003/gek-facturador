import { InvalidInvoiceSeriesError } from '../errors/invoice-errors';

/** Invoice series: exactly 4 alphanumeric characters starting with 'F' (e.g. F001). */
export class InvoiceSeries {
  private constructor(private readonly value: string) {}

  static create(value: string): InvoiceSeries {
    const normalized = value?.trim().toUpperCase() ?? '';
    if (!/^F[A-Z0-9]{3}$/.test(normalized)) {
      throw new InvalidInvoiceSeriesError(
        `Invoice series must be 4 alphanumeric characters starting with "F": "${value}".`,
      );
    }
    return new InvoiceSeries(normalized);
  }

  toString(): string {
    return this.value;
  }
}
