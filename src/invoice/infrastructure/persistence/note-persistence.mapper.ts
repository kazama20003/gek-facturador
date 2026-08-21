import type {
  Prisma,
  note as NoteRow,
  note_item as NoteItemRow,
} from '@prisma/client';
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

type RowWithItems = NoteRow & { items: NoteItemRow[] };

/** Translates between the Note aggregate and Prisma rows. */
export class NotePersistenceMapper {
  static toRow(note: Note): Prisma.noteCreateInput {
    const address = note.issuer.address;
    return {
      id: note.id,
      document_type: note.documentType,
      series: note.series.toString(),
      correlative: note.correlative.toNumber(),
      issue_date: note.issueDate,
      currency: note.currency,
      reason_code: note.reason.code,
      reason_description: note.reason.description,
      modified_document_type: note.modifies.documentType,
      modified_series: note.modifies.series.toString(),
      modified_correlative: note.modifies.correlative.toNumber(),
      issuer_ruc: note.issuer.ruc.toString(),
      issuer_business_name: note.issuer.businessName,
      issuer_trade_name: note.issuer.tradeName ?? null,
      issuer_ubigeo: address?.ubigeo ?? null,
      issuer_department: address?.department ?? null,
      issuer_province: address?.province ?? null,
      issuer_district: address?.district ?? null,
      issuer_address_line: address?.addressLine ?? null,
      customer_ruc: note.customer.ruc.toString(),
      customer_business_name: note.customer.businessName,
      taxable_amount: note.taxableAmount.toFixed(),
      igv: note.igv.toFixed(),
      sale_value: note.saleValue.toFixed(),
      total: note.total.toFixed(),
      status: 'ISSUED',
      items: {
        create: note.lines.map((line, index) => ({
          line_number: index + 1,
          code: line.code ?? null,
          description: line.description,
          unit_code: line.unitCode,
          quantity: line.quantity.toString(),
          unit_value: line.unitValue.toFixed(),
          taxable_amount: line.taxableAmount.toFixed(),
          igv: line.igv.toFixed(),
          unit_price: line.unitPrice.toFixed(),
          total: line.total.toFixed(),
        })),
      },
    };
  }

  /** Rebuilds the aggregate through its factories, re-running invariants. */
  static toAggregate(row: RowWithItems): Note {
    const currency = row.currency as Currency;
    const type = row.document_type as NoteType;
    const base = {
      id: row.id,
      series: NoteSeries.create(row.series),
      correlative: Correlative.create(row.correlative),
      issueDate: row.issue_date,
      currency,
      issuer: Party.create({
        ruc: Ruc.create(row.issuer_ruc),
        businessName: row.issuer_business_name,
        tradeName: row.issuer_trade_name ?? undefined,
        address:
          row.issuer_ubigeo &&
          row.issuer_department &&
          row.issuer_province &&
          row.issuer_district &&
          row.issuer_address_line
            ? Address.create({
                ubigeo: row.issuer_ubigeo,
                department: row.issuer_department,
                province: row.issuer_province,
                district: row.issuer_district,
                addressLine: row.issuer_address_line,
              })
            : undefined,
      }),
      customer: Party.create({
        ruc: Ruc.create(row.customer_ruc),
        businessName: row.customer_business_name,
      }),
      reason: NoteReason.create(type, row.reason_code, row.reason_description),
      modifies: ModifiedDocumentReference.toInvoice({
        series: row.modified_series,
        correlative: row.modified_correlative,
      }),
    };

    const note =
      type === NoteType.Credit
        ? Note.createCredit(base)
        : Note.createDebit(base);

    for (const item of [...row.items].sort(
      (a, b) => a.line_number - b.line_number,
    )) {
      note.addTaxableItem({
        code: item.code ?? undefined,
        description: item.description,
        unitCode: item.unit_code,
        quantity: Quantity.create(item.quantity.toString()),
        unitValue: Money.create(item.unit_value.toString(), currency),
      });
    }

    note.issue();
    return note;
  }
}
