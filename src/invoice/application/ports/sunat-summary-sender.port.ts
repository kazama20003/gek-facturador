import type { CdrResult } from './sunat-bill-sender.port';

export interface SunatTicket {
  readonly ticket: string;
}

export interface SunatSummaryStatus {
  /** SUNAT statusCode: '0' processed OK, '98' still in progress, '99' processed with errors. */
  readonly statusCode: string;
  readonly cdr?: CdrResult;
  readonly cdrZipBase64?: string;
}

/** Port: asynchronous SUNAT submissions (daily summaries, voided documents). */
export interface SunatSummarySender {
  sendSummary(zipFileName: string, zipContent: Buffer): Promise<SunatTicket>;
  getStatus(ticket: string): Promise<SunatSummaryStatus>;
}

export const SUNAT_SUMMARY_SENDER = Symbol('SunatSummarySender');
