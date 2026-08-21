import type {
  CdrQuery,
  SunatBillSender,
  SunatSendResult,
} from '../../application/ports/sunat-bill-sender.port';
import { SunatSoapFaultError } from './sunat-soap-client';

/**
 * A transient SUNAT failure is worth retrying: network errors, HTTP 5xx, and
 * the intermittent 401/timeouts the beta returns. SOAP faults are business
 * rejections (bad XML, wrong data) and must NOT be retried.
 */
export function isTransientSunatError(error: unknown): boolean {
  if (error instanceof SunatSoapFaultError) return false;
  const message = error instanceof Error ? error.message : String(error);
  return (
    /HTTP (5\d\d|401|403|429)/.test(message) ||
    /timeout|timed out|ECONNRESET|ECONNREFUSED|ENOTFOUND|network|fetch failed/i.test(
      message,
    )
  );
}

/**
 * Decorates a SunatBillSender with exponential-backoff retries for transient
 * failures. Deterministic delays (no jitter) so it stays test-friendly.
 */
export class RetryingSunatBillSender implements SunatBillSender {
  constructor(
    private readonly inner: SunatBillSender,
    private readonly attempts = 3,
    private readonly baseDelayMs = 1_000,
    private readonly delay: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  send(zipFileName: string, zipContent: Buffer): Promise<SunatSendResult> {
    return this.withRetry(() => this.inner.send(zipFileName, zipContent));
  }

  getStatusCdr(query: CdrQuery): Promise<SunatSendResult> {
    return this.withRetry(() => this.inner.getStatusCdr(query));
  }

  private async withRetry<T>(op: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.attempts; attempt++) {
      try {
        return await op();
      } catch (error) {
        lastError = error;
        if (attempt === this.attempts || !isTransientSunatError(error))
          throw error;
        await this.delay(this.baseDelayMs * 2 ** (attempt - 1));
      }
    }
    throw lastError;
  }
}
