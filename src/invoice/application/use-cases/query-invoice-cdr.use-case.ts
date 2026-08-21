import { InvoiceNotFoundError } from '../../domain/errors/invoice-errors';
import type {
  InvoiceRepository,
  SunatOutcome,
} from '../ports/invoice-repository.port';
import type { SunatBillSender } from '../ports/sunat-bill-sender.port';

export interface QueryInvoiceCdrResult {
  readonly responseCode: string;
  readonly description: string;
  readonly notes: ReadonlyArray<string>;
  readonly accepted: boolean;
}

/**
 * Re-queries SUNAT for the CDR of a persisted invoice (getStatusCdr) and
 * updates its stored status. Useful when a previous submission timed out but
 * SUNAT actually processed the document.
 */
export class QueryInvoiceCdrUseCase {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly sender: SunatBillSender,
  ) {}

  async execute(id: string): Promise<QueryInvoiceCdrResult> {
    const stored = await this.invoices.findById(id);
    if (!stored) {
      throw new InvoiceNotFoundError(id);
    }

    const result = await this.sender.getStatusCdr({
      issuerRuc: stored.invoice.issuer.ruc.toString(),
      documentType: stored.invoice.documentType,
      series: stored.invoice.series.toString(),
      correlative: stored.invoice.correlative.toNumber(),
    });

    const outcome: SunatOutcome = {
      fileName:
        [
          stored.invoice.issuer.ruc.toString(),
          stored.invoice.documentType,
          stored.invoice.series.toString(),
          stored.invoice.correlative.toNumber(),
        ].join('-') + '.zip',
      cdr: result.cdr,
      cdrZipBase64: result.cdrZipBase64,
      signedXml: stored.sunat?.fileName ? '' : '',
    };
    await this.invoices.recordSunatOutcome(id, outcome);

    return {
      responseCode: result.cdr.responseCode,
      description: result.cdr.description,
      notes: result.cdr.notes,
      accepted: result.cdr.accepted,
    };
  }
}
