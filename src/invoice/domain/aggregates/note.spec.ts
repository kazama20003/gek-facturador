import { Note } from './note';
import {
  CurrencyMismatchError,
  InvalidNoteReasonError,
  InvalidNoteSeriesError,
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
import { Ruc } from '../value-objects/ruc';

function baseProps() {
  return {
    id: 'note-1',
    series: NoteSeries.create('F001'),
    correlative: Correlative.create(1),
    issueDate: new Date('2026-08-20'),
    currency: Currency.PEN,
    issuer: Party.create({
      ruc: Ruc.create('20000000001'),
      businessName: 'EMITEC SAC',
    }),
    customer: Party.create({
      ruc: Ruc.create('20100070970'),
      businessName: 'CLIENTE SAC',
    }),
    reason: NoteReason.create(NoteType.Credit, '01'),
    modifies: ModifiedDocumentReference.toInvoice({
      series: 'F001',
      correlative: 1,
    }),
  };
}

describe('Note (domain)', () => {
  it('computes totals like an invoice and carries the reference', () => {
    const note = Note.createCredit(baseProps());
    note.addTaxableItem({
      description: 'Servicio de transporte',
      unitCode: 'ZZ',
      quantity: Quantity.create('1'),
      unitValue: Money.pen('100.00'),
    });
    note.issue();

    expect(note.documentType).toBe('07');
    expect(note.taxableAmount.toFixed()).toBe('100.00');
    expect(note.igv.toFixed()).toBe('18.00');
    expect(note.total.toFixed()).toBe('118.00');
    expect(note.modifies.id).toBe('F001-1');
    expect(note.modifies.documentType).toBe('01');
    expect(note.reason.description).toBe('Anulacion de la operacion');
  });

  it('rejects issuing without items and mismatched currency', () => {
    const note = Note.createDebit({
      ...baseProps(),
      reason: NoteReason.create(NoteType.Debit, '02'),
    });
    expect(note.documentType).toBe('08');
    expect(() => note.issue()).toThrow(NoteWithoutItemsError);
    expect(() =>
      note.addTaxableItem({
        description: 'x',
        unitCode: 'ZZ',
        quantity: Quantity.create('1'),
        unitValue: Money.usd('1.00'),
      }),
    ).toThrow(CurrencyMismatchError);
  });

  it('validates series and reason catalogs', () => {
    expect(() => NoteSeries.create('X001')).toThrow(InvalidNoteSeriesError);
    expect(NoteSeries.create('b001').toString()).toBe('B001');
    expect(() => NoteReason.create(NoteType.Credit, '99')).toThrow(
      InvalidNoteReasonError,
    );
    expect(() => NoteReason.create(NoteType.Debit, '06')).toThrow(
      InvalidNoteReasonError,
    );
    expect(NoteReason.create(NoteType.Debit, '01').description).toBe(
      'Intereses por mora',
    );
  });
});
