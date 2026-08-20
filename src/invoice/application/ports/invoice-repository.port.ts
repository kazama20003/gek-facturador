import { Invoice } from '../../domain/aggregates/invoice';
import type { CdrResult } from './sunat-bill-sender.port';

export type InvoiceStatus = 'ISSUED' | 'ACCEPTED' | 'REJECTED';

export interface SunatOutcome {
  readonly fileName: string;
  readonly cdr: CdrResult;
  readonly cdrZipBase64: string;
  readonly signedXml: string;
}

/** Persisted view: the aggregate plus submission state kept outside the domain. */
export interface StoredInvoice {
  readonly invoice: Invoice;
  readonly status: InvoiceStatus;
  readonly sunat?: {
    readonly fileName: string;
    readonly responseCode: string;
    readonly description: string;
    readonly notes: ReadonlyArray<string>;
  };
}

/** Port: invoice persistence. Infrastructure implements it (Prisma or in-memory). */
export interface InvoiceRepository {
  save(invoice: Invoice): Promise<void>;
  findById(id: string): Promise<StoredInvoice | null>;
  existsSeriesCorrelative(
    issuerRuc: string,
    documentType: string,
    series: string,
    correlative: number,
  ): Promise<boolean>;
  recordSunatOutcome(id: string, outcome: SunatOutcome): Promise<void>;
}

export const INVOICE_REPOSITORY = Symbol('InvoiceRepository');
