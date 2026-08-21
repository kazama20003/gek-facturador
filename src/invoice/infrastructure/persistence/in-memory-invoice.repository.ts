import type {
  InvoiceRepository,
  InvoiceStatus,
  StoredInvoice,
  SunatOutcome,
} from '../../application/ports/invoice-repository.port';
import { Invoice } from '../../domain/aggregates/invoice';

interface Entry {
  invoice: Invoice;
  status: InvoiceStatus;
  sunat?: StoredInvoice['sunat'];
}

/**
 * Volatile repository used in tests and as a development fallback when
 * DATABASE_URL is not configured. Data is lost on restart.
 */
export class InMemoryInvoiceRepository implements InvoiceRepository {
  private readonly entries = new Map<string, Entry>();

  save(invoice: Invoice): Promise<void> {
    this.entries.set(invoice.id, { invoice, status: 'ISSUED' });
    return Promise.resolve();
  }

  findById(id: string): Promise<StoredInvoice | null> {
    const entry = this.entries.get(id);
    return Promise.resolve(entry ? { ...entry } : null);
  }

  existsSeriesCorrelative(
    issuerRuc: string,
    documentType: string,
    series: string,
    correlative: number,
  ): Promise<boolean> {
    for (const { invoice } of this.entries.values()) {
      if (
        invoice.issuer.ruc.toString() === issuerRuc &&
        invoice.documentType === documentType &&
        invoice.series.toString() === series &&
        invoice.correlative.toNumber() === correlative
      ) {
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(false);
  }

  recordSunatOutcome(id: string, outcome: SunatOutcome): Promise<void> {
    const entry = this.entries.get(id);
    if (entry) {
      entry.status = outcome.cdr.accepted ? 'ACCEPTED' : 'REJECTED';
      entry.sunat = {
        fileName: outcome.fileName,
        responseCode: outcome.cdr.responseCode,
        description: outcome.cdr.description,
        notes: outcome.cdr.notes,
      };
    }
    return Promise.resolve();
  }

  findBoletasByIssueDate(
    issuerRuc: string,
    issueDate: string,
  ): Promise<StoredInvoice[]> {
    const matches: StoredInvoice[] = [];
    for (const entry of this.entries.values()) {
      const { invoice } = entry;
      if (
        invoice.documentType === '03' &&
        invoice.issuer.ruc.toString() === issuerRuc &&
        invoice.issueDate.toISOString().slice(0, 10) === issueDate
      ) {
        matches.push({ ...entry });
      }
    }
    return Promise.resolve(matches);
  }
}
