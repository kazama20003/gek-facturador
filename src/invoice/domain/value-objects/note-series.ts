import { InvalidNoteSeriesError } from '../errors/invoice-errors';

/**
 * Note series: 4 alphanumeric characters. Starts with 'F' when the note
 * modifies an invoice, 'B' when it modifies a boleta.
 */
export class NoteSeries {
  private constructor(private readonly value: string) {}

  static create(value: string): NoteSeries {
    const normalized = value?.trim().toUpperCase() ?? '';
    if (!/^[FB][A-Z0-9]{3}$/.test(normalized)) {
      throw new InvalidNoteSeriesError(
        `Note series must be 4 alphanumeric characters starting with "F" or "B": "${value}".`,
      );
    }
    return new NoteSeries(normalized);
  }

  toString(): string {
    return this.value;
  }
}
