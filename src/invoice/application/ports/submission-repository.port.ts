import type { CdrResult } from './sunat-bill-sender.port';

export interface SubmissionRecord {
  /** RC (daily summary) | RA (voided communication). */
  kind: 'RC' | 'RA';
  /** Document id, e.g. RC-20260820-1 / RA-20260820-1. */
  documentId: string;
  fileName: string;
  ticket: string;
  statusCode: string;
  cdr?: CdrResult;
  cdrZipBase64?: string;
  signedXml: string;
}

/** Port: audit log of asynchronous SUNAT submissions (RC/RA with their tickets). */
export interface SubmissionRepository {
  record(entry: SubmissionRecord): Promise<void>;
  /** Latest submission for a document id (RC-… / RA-…), or null. */
  findByDocumentId(documentId: string): Promise<SubmissionRecord | null>;
}

export const SUBMISSION_REPOSITORY = Symbol('SubmissionRepository');
