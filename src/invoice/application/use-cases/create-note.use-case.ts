import { randomUUID } from 'node:crypto';
import { Note } from '../../domain/aggregates/note';
import { DuplicateNoteError } from '../../domain/errors/invoice-errors';
import type { NoteRepository } from '../ports/note-repository.port';
import { Address } from '../../domain/value-objects/address';
import { Correlative } from '../../domain/value-objects/correlative';
import { Currency } from '../../domain/value-objects/currency';
import { ModifiedDocumentReference } from '../../domain/value-objects/modified-document-reference';
import { Money } from '../../domain/value-objects/money';
import { NoteReason } from '../../domain/value-objects/note-reason';
import { NoteSeries } from '../../domain/value-objects/note-series';
import { NoteType } from '../../domain/value-objects/note-type.enum';
import { Party } from '../../domain/value-objects/party';
import { Quantity } from '../../domain/value-objects/quantity';
import { Ruc } from '../../domain/value-objects/ruc';
import type { AddressInput } from './create-invoice.use-case';

/** Primitive input for credit/debit notes. */
export interface CreateNoteCommand {
  series: string;
  correlative: number;
  issueDate: string;
  currency: 'PEN' | 'USD';
  /** SUNAT reason code — catalog 09 (credit) or 10 (debit). */
  reasonCode: string;
  reasonDescription?: string;
  /** Referenced invoice, e.g. { series: "F001", correlative: 1 }. */
  modifies: { series: string; correlative: number };
  issuer: {
    ruc: string;
    businessName: string;
    tradeName?: string;
    address?: AddressInput;
  };
  customer: { ruc: string; businessName: string };
  items: Array<{
    code?: string;
    description: string;
    unitCode: string;
    quantity: string;
    unitValue: string;
  }>;
}

/** Immutable, JSON-serializable note result. */
export interface CreateNoteResult {
  id: string;
  documentType: string;
  series: string;
  correlative: number;
  issueDate: string;
  currency: string;
  reasonCode: string;
  reasonDescription: string;
  modifies: { documentType: string; series: string; correlative: number };
  issuer: { ruc: string; businessName: string };
  customer: { ruc: string; businessName: string };
  taxableAmount: string;
  igv: string;
  saleValue: string;
  total: string;
  items: Array<{
    code?: string;
    description: string;
    unitCode: string;
    quantity: string;
    unitValue: string;
    taxableAmount: string;
    igv: string;
    unitPrice: string;
    total: string;
  }>;
}

/** Serializes the Note aggregate for API responses. */
export function serializeNote(note: Note): CreateNoteResult {
  return {
    id: note.id,
    documentType: note.documentType,
    series: note.series.toString(),
    correlative: note.correlative.toNumber(),
    issueDate: note.issueDate.toISOString(),
    currency: note.currency,
    reasonCode: note.reason.code,
    reasonDescription: note.reason.description,
    modifies: {
      documentType: note.modifies.documentType,
      series: note.modifies.series.toString(),
      correlative: note.modifies.correlative.toNumber(),
    },
    issuer: {
      ruc: note.issuer.ruc.toString(),
      businessName: note.issuer.businessName,
    },
    customer: {
      ruc: note.customer.ruc.toString(),
      businessName: note.customer.businessName,
    },
    taxableAmount: note.taxableAmount.toFixed(),
    igv: note.igv.toFixed(),
    saleValue: note.saleValue.toFixed(),
    total: note.total.toFixed(),
    items: note.lines.map((line) => ({
      code: line.code,
      description: line.description,
      unitCode: line.unitCode,
      quantity: line.quantity.toString(),
      unitValue: line.unitValue.toFixed(),
      taxableAmount: line.taxableAmount.toFixed(),
      igv: line.igv.toFixed(),
      unitPrice: line.unitPrice.toFixed(),
      total: line.total.toFixed(),
    })),
  };
}

/**
 * Builds, issues and persists a Note. Rejects duplicated series+correlative
 * per issuer and note type.
 */
export class CreateNoteUseCase {
  constructor(private readonly notes: NoteRepository) {}

  async execute(
    type: NoteType,
    command: CreateNoteCommand,
  ): Promise<CreateNoteResult> {
    const note = this.buildAggregate(type, command);

    const duplicated = await this.notes.existsSeriesCorrelative(
      note.issuer.ruc.toString(),
      note.documentType,
      note.series.toString(),
      note.correlative.toNumber(),
    );
    if (duplicated) {
      throw new DuplicateNoteError(
        note.series.toString(),
        note.correlative.toNumber(),
      );
    }

    await this.notes.save(note);
    return serializeNote(note);
  }

  buildAggregate(type: NoteType, command: CreateNoteCommand): Note {
    const currency = Currency[command.currency];

    const base = {
      id: randomUUID(),
      series: NoteSeries.create(command.series),
      correlative: Correlative.create(command.correlative),
      issueDate: new Date(command.issueDate),
      currency,
      issuer: Party.create({
        ruc: Ruc.create(command.issuer.ruc),
        businessName: command.issuer.businessName,
        tradeName: command.issuer.tradeName,
        address: command.issuer.address
          ? Address.create(command.issuer.address)
          : undefined,
      }),
      customer: Party.create({
        ruc: Ruc.create(command.customer.ruc),
        businessName: command.customer.businessName,
      }),
      reason: NoteReason.create(
        type,
        command.reasonCode,
        command.reasonDescription,
      ),
      modifies: ModifiedDocumentReference.toInvoice(command.modifies),
    };

    const note =
      type === NoteType.Credit
        ? Note.createCredit(base)
        : Note.createDebit(base);

    for (const item of command.items) {
      note.addTaxableItem({
        code: item.code,
        description: item.description,
        unitCode: item.unitCode,
        quantity: Quantity.create(item.quantity),
        unitValue: Money.create(item.unitValue, currency),
      });
    }

    note.issue();
    return note;
  }
}
