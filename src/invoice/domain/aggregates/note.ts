import { InvoiceItem } from '../entities/invoice-item';
import {
  CurrencyMismatchError,
  NoteWithoutItemsError,
} from '../errors/invoice-errors';
import { Correlative } from '../value-objects/correlative';
import { Currency } from '../value-objects/currency';
import { ModifiedDocumentReference } from '../value-objects/modified-document-reference';
import { Money } from '../value-objects/money';
import { NoteReason } from '../value-objects/note-reason';
import { NoteSeries } from '../value-objects/note-series';
import { NoteType } from '../value-objects/note-type.enum';
import { Party } from '../value-objects/party';
import { Quantity } from '../value-objects/quantity';

interface NoteProps {
  id: string;
  type: NoteType;
  series: NoteSeries;
  correlative: Correlative;
  issueDate: Date;
  currency: Currency;
  issuer: Party;
  customer: Party;
  reason: NoteReason;
  modifies: ModifiedDocumentReference;
}

/**
 * Credit (07) or debit (08) note — aggregate root. Shares line and total
 * semantics with Invoice: everything is derived from taxed items.
 */
export class Note {
  private readonly items: InvoiceItem[] = [];

  private constructor(private readonly props: NoteProps) {}

  static createCredit(
    params: Omit<NoteProps, 'type' | 'reason'> & { reason: NoteReason },
  ): Note {
    return new Note({ ...params, type: NoteType.Credit });
  }

  static createDebit(
    params: Omit<NoteProps, 'type' | 'reason'> & { reason: NoteReason },
  ): Note {
    return new Note({ ...params, type: NoteType.Debit });
  }

  addTaxableItem(params: {
    code?: string;
    description: string;
    unitCode: string;
    quantity: Quantity;
    unitValue: Money;
  }): void {
    if (params.unitValue.currency !== this.props.currency) {
      throw new CurrencyMismatchError(
        `Item currency ${params.unitValue.currency} does not match note currency ${this.props.currency}.`,
      );
    }
    this.items.push(InvoiceItem.createTaxed(params));
  }

  issue(): void {
    if (this.items.length === 0) {
      throw new NoteWithoutItemsError();
    }
  }

  get id(): string {
    return this.props.id;
  }
  get documentType(): string {
    return this.props.type;
  }
  get type(): NoteType {
    return this.props.type;
  }
  get series(): NoteSeries {
    return this.props.series;
  }
  get correlative(): Correlative {
    return this.props.correlative;
  }
  get issueDate(): Date {
    return this.props.issueDate;
  }
  get currency(): Currency {
    return this.props.currency;
  }
  get issuer(): Party {
    return this.props.issuer;
  }
  get customer(): Party {
    return this.props.customer;
  }
  get reason(): NoteReason {
    return this.props.reason;
  }
  get modifies(): ModifiedDocumentReference {
    return this.props.modifies;
  }

  get lines(): readonly InvoiceItem[] {
    return [...this.items];
  }

  get taxableAmount(): Money {
    return this.items.reduce(
      (acc, item) => acc.add(item.taxableAmount),
      Money.zero(this.props.currency),
    );
  }

  /** Notes only carry taxed lines for now; these keep the projection shape. */
  get exoneratedAmount(): Money {
    return Money.zero(this.props.currency);
  }

  get unaffectedAmount(): Money {
    return Money.zero(this.props.currency);
  }

  get igv(): Money {
    return this.items.reduce(
      (acc, item) => acc.add(item.igv),
      Money.zero(this.props.currency),
    );
  }

  get saleValue(): Money {
    return this.taxableAmount;
  }

  get total(): Money {
    return this.taxableAmount.add(this.igv);
  }
}
