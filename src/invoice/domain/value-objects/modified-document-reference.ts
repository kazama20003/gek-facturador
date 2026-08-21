import { InvalidCorrelativeError } from '../errors/invoice-errors';
import { Correlative } from './correlative';
import { InvoiceSeries } from './invoice-series';

/** Reference to the invoice a note modifies (BillingReference in UBL). */
export class ModifiedDocumentReference {
  private constructor(
    /** SUNAT catalog 01 code of the referenced document (01 = invoice). */
    readonly documentType: string,
    readonly series: InvoiceSeries,
    readonly correlative: Correlative,
  ) {}

  static toInvoice(params: {
    series: string;
    correlative: number;
  }): ModifiedDocumentReference {
    if (!Number.isInteger(params.correlative)) {
      throw new InvalidCorrelativeError(
        `Invalid referenced correlative: ${params.correlative}.`,
      );
    }
    return new ModifiedDocumentReference(
      '01',
      InvoiceSeries.create(params.series),
      Correlative.create(params.correlative),
    );
  }

  get id(): string {
    return `${this.series.toString()}-${this.correlative.toNumber()}`;
  }
}
