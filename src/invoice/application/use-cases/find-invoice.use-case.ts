import { InvoiceNotFoundError } from '../../domain/errors/invoice-errors';
import type {
  InvoiceRepository,
  InvoiceStatus,
} from '../ports/invoice-repository.port';
import {
  serializeInvoice,
  type CreateInvoiceResult,
} from './create-invoice.use-case';

export interface FindInvoiceResult extends CreateInvoiceResult {
  status: InvoiceStatus;
  sunat?: {
    fileName: string;
    responseCode: string;
    description: string;
    notes: ReadonlyArray<string>;
  };
}

/** Returns a persisted invoice with its SUNAT submission state. */
export class FindInvoiceUseCase {
  constructor(private readonly invoices: InvoiceRepository) {}

  async execute(id: string): Promise<FindInvoiceResult> {
    const stored = await this.invoices.findById(id);
    if (!stored) {
      throw new InvoiceNotFoundError(id);
    }
    return {
      ...serializeInvoice(stored.invoice),
      status: stored.status,
      sunat: stored.sunat,
    };
  }
}
