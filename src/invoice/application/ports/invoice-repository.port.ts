import { Invoice } from '../../domain/aggregates/invoice';
import type { CdrResult } from './sunat-bill-sender.port';

export type InvoiceStatus = 'ISSUED' | 'ACCEPTED' | 'REJECTED' | 'VOIDED';

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
  /** Signed UBL XML stored after a SUNAT submission, when available. */
  readonly signedXml?: string;
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
  /** Boletas (03) issued on the given date (YYYY-MM-DD) by the issuer, for the daily summary. */
  findBoletasByIssueDate(
    issuerRuc: string,
    issueDate: string,
  ): Promise<StoredInvoice[]>;
  /** Marks a document VOIDED after SUNAT accepts the RA communication. */
  markVoided(id: string, outcome: SunatOutcome): Promise<void>;
}

export const INVOICE_REPOSITORY = Symbol('InvoiceRepository');
