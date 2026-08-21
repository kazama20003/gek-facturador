import { randomUUID } from 'node:crypto';
import { Note } from '../../domain/aggregates/note';
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

/** Builds and issues a Note aggregate from primitives. No persistence yet. */
export class CreateNoteUseCase {
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
