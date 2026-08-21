import { InvalidCorrelativeError } from '../errors/invoice-errors';
import { Correlative } from './correlative';
import { InvoiceSeries } from './invoice-series';

/** Reference to the document a note modifies (BillingReference in UBL). */
export class ModifiedDocumentReference {
  private constructor(
    /** SUNAT catalog 01 code of the referenced document: 01 invoice, 03 boleta. */
    readonly documentType: string,
    readonly series: InvoiceSeries,
    readonly correlative: Correlative,
  ) {}

  static toInvoice(params: {
    series: string;
    correlative: number;
  }): ModifiedDocumentReference {
    return ModifiedDocumentReference.to('01', params);
  }

  static toBoleta(params: {
    series: string;
    correlative: number;
  }): ModifiedDocumentReference {
    return ModifiedDocumentReference.to('03', params);
  }

  static to(
    documentType: '01' | '03',
    params: { series: string; correlative: number },
  ): ModifiedDocumentReference {
    const series = InvoiceSeries.create(params.series);
    const expectedPrefix = documentType === '01' ? 'F' : 'B';
    if (!series.startsWith(expectedPrefix)) {
      throw new InvalidCorrelativeError(
        `Referenced document type ${documentType} requires a series starting with "${expectedPrefix}": "${params.series}".`,
      );
    }
    return new ModifiedDocumentReference(
      documentType,
      series,
      Correlative.create(params.correlative),
    );
  }

  get id(): string {
    return `${this.series.toString()}-${this.correlative.toNumber()}`;
  }
}
