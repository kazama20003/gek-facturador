import { InvoiceNotFoundError } from '../../domain/errors/invoice-errors';
import type { InvoiceRepository } from '../ports/invoice-repository.port';
import {
  SendInvoiceToSunatUseCase,
  type SendInvoiceToSunatResult,
} from './send-invoice-to-sunat.use-case';

/**
 * Loads a persisted invoice, submits it to SUNAT and records the CDR outcome
 * (status ACCEPTED/REJECTED, CDR data, signed XML) back into the repository.
 */
export class SubmitStoredInvoiceUseCase {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly sendToSunat: SendInvoiceToSunatUseCase,
  ) {}

  async execute(id: string): Promise<SendInvoiceToSunatResult> {
    const stored = await this.invoices.findById(id);
    if (!stored) {
      throw new InvoiceNotFoundError(id);
    }

    // Idempotent: an already-accepted invoice is never re-sent to SUNAT.
    if (stored.status === 'ACCEPTED' && stored.sunat) {
      return {
        fileName: stored.sunat.fileName,
        cdr: {
          responseCode: stored.sunat.responseCode,
          description: stored.sunat.description,
          notes: stored.sunat.notes,
          accepted: true,
        },
        cdrZipBase64: '',
        signedXml: '',
        alreadyAccepted: true,
      };
    }

    const result = await this.sendToSunat.execute(stored.invoice);
    await this.invoices.recordSunatOutcome(id, result);
    return result;
  }
}
