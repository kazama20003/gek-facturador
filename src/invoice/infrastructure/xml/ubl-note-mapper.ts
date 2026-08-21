import { Note } from '../../domain/aggregates/note';
import { InvalidPartyError } from '../../domain/errors/invoice-errors';
import type { AmountInWordsConverter } from '../../application/ports/amount-in-words-converter.port';
import { IgvAffectationType } from '../../domain/value-objects/igv-affectation-type';
import { Money } from '../../domain/value-objects/money';
import { NoteType } from '../../domain/value-objects/note-type.enum';
import { igvAffectationCode, IGV_PERCENT } from './ubl-catalog-mapper';
import type { UblInvoiceDocument, UblLine } from './ubl-invoice-mapper';

/** Read-only projection of a Note for XML generation. */
export interface UblNoteDocument extends Omit<UblInvoiceDocument, 'lines'> {
  readonly type: NoteType;
  readonly reason: { readonly code: string; readonly description: string };
  readonly modifies: { readonly id: string; readonly documentType: string };
  readonly lines: ReadonlyArray<UblLine>;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isoTime(date: Date): string {
  return date.toISOString().slice(11, 19);
}

/** Maps the Note aggregate to the UBL projection. Read-only. */
export class UblNoteMapper {
  constructor(private readonly amountInWords: AmountInWordsConverter) {}

  map(note: Note): UblNoteDocument {
    const address = note.issuer.address;
    if (!address) {
      throw new InvalidPartyError(
        'Issuer fiscal address (ubigeo, department, province, district, address line) is required to generate the UBL XML.',
      );
    }

    return {
      type: note.type,
      documentType: note.documentType,
      operationType: '0101',
      // Notes carry no payment terms; the field exists only to share the projection shape.
      payment: { isCredit: false, installments: [] },
      id: `${note.series.toString()}-${note.correlative.toNumber()}`,
      issueDate: isoDate(note.issueDate),
      issueTime: isoTime(note.issueDate),
      currency: note.currency,
      amountInWords: this.amountInWords.convert(note.total),
      reason: { code: note.reason.code, description: note.reason.description },
      modifies: {
        id: note.modifies.id,
        documentType: note.modifies.documentType,
      },
      issuer: {
        ruc: note.issuer.ruc.toString(),
        businessName: note.issuer.businessName,
        tradeName: note.issuer.tradeName,
        address: {
          ubigeo: address.ubigeo,
          department: address.department,
          province: address.province,
          district: address.district,
          addressLine: address.addressLine,
        },
      },
      customer: {
        docCode: note.customer.identity.code,
        docNumber: note.customer.identity.toString(),
        businessName: note.customer.businessName,
      },
      taxableAmount: note.taxableAmount.toFixed(),
      exoneratedAmount: note.exoneratedAmount.toFixed(),
      unaffectedAmount: note.unaffectedAmount.toFixed(),
      freeAmount: '0.00',
      freeIgv: '0.00',
      globalDiscount: '0.00',
      lineExtensionTotal: note.saleValue.toFixed(),
      igv: note.igv.toFixed(),
      saleValue: note.saleValue.toFixed(),
      total: note.total.toFixed(),
      taxSubtotals: (
        [
          {
            base: note.taxableAmount,
            tax: note.igv,
            type: IgvAffectationType.TAXED_OPERATION,
          },
          {
            base: note.exoneratedAmount,
            tax: Money.zero(note.currency),
            type: IgvAffectationType.EXONERATED,
          },
          {
            base: note.unaffectedAmount,
            tax: Money.zero(note.currency),
            type: IgvAffectationType.UNAFFECTED,
          },
        ] as const
      )
        .filter((g) => g.base.toFixed() !== '0.00')
        .map((g) => ({
          taxableAmount: g.base.toFixed(),
          taxAmount: g.tax.toFixed(),
          tax: {
            id: g.type.taxScheme.id,
            name: g.type.taxScheme.name,
            internationalCode: g.type.taxScheme.internationalCode,
          },
        })),
      lines: note.lines.map((line, index) => ({
        number: index + 1,
        quantity: line.quantity.toString(),
        unitCode: line.unitCode,
        taxableAmount: line.taxableAmount.toFixed(),
        unitPriceWithIgv: line.unitPrice.toFixed(),
        igvAmount: line.igv.toFixed(),
        igvPercent: line.affectation.isTaxed() ? IGV_PERCENT : '0.00',
        affectationCode: igvAffectationCode(line.affectation),
        tax: {
          id: line.affectation.taxScheme.id,
          name: line.affectation.taxScheme.name,
          internationalCode: line.affectation.taxScheme.internationalCode,
        },
        description: line.description,
        code: line.code,
        unitValue: line.unitValue.toFixed(),
        priceTypeCode: '01',
        isFree: false,
        discount: '0.00',
        discountBase: '0.00',
      })),
    };
  }
}
