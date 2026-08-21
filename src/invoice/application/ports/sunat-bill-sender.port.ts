/** Parsed content of SUNAT's CDR (Constancia de Recepción, ApplicationResponse). */
export interface CdrResult {
  /** "0" = accepted; 0100-1999 SOAP/sender errors; 2000-3999 rejections; ≥4000 observations. */
  readonly responseCode: string;
  readonly description: string;
  readonly notes: ReadonlyArray<string>;
  readonly accepted: boolean;
}

export interface SunatSendResult {
  readonly cdr: CdrResult;
  /** Raw CDR ZIP returned by SUNAT, base64-encoded (kept for audit/storage). */
  readonly cdrZipBase64: string;
}

export interface CdrQuery {
  issuerRuc: string;
  documentType: string;
  series: string;
  correlative: number;
}

/** Port: submits the invoice ZIP to SUNAT's billService (sendBill). */
export interface SunatBillSender {
  send(zipFileName: string, zipContent: Buffer): Promise<SunatSendResult>;
  /** Re-queries the CDR of an already-submitted document. */
  getStatusCdr(query: CdrQuery): Promise<SunatSendResult>;
}

export const SUNAT_BILL_SENDER = Symbol('SunatBillSender');
