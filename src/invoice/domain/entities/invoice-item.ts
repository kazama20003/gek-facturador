import { InvalidInvoiceItemError } from '../errors/invoice-errors';
import { IGV_MULTIPLIER, IGV_RATE } from '../services/igv';
import { IgvAffectationType } from '../value-objects/igv-affectation-type';
import { Money } from '../value-objects/money';
import { Quantity } from '../value-objects/quantity';

/**
 * Invoice line. All tax amounts are derived here — never accepted from input:
 *   taxableAmount = unitValue × quantity
 *   igv           = taxableAmount × 18%
 *   unitPrice     = unitValue × 1.18 (IGV-inclusive)
 *   total         = taxableAmount + igv
 */
export class InvoiceItem {
  private constructor(
    readonly code: string | undefined,
    readonly description: string,
    readonly unitCode: string,
    readonly quantity: Quantity,
    readonly unitValue: Money,
    readonly affectation: IgvAffectationType,
    readonly taxableAmount: Money,
    readonly igv: Money,
    readonly unitPrice: Money,
    readonly total: Money,
  ) {}

  /** Backwards-compatible helper: a taxed (10) line. */
  static createTaxed(params: {
    code?: string;
    description: string;
    unitCode: string;
    quantity: Quantity;
    unitValue: Money;
  }): InvoiceItem {
    return InvoiceItem.create({
      ...params,
      affectation: IgvAffectationType.TAXED_OPERATION,
    });
  }

  static create(params: {
    code?: string;
    description: string;
    unitCode: string;
    quantity: Quantity;
    unitValue: Money;
    affectation: IgvAffectationType;
  }): InvoiceItem {
    const description = params.description?.trim() ?? '';
    if (description.length === 0) {
      throw new InvalidInvoiceItemError('Item description is required.');
    }
    const unitCode = params.unitCode?.trim() ?? '';
    if (unitCode.length === 0) {
      throw new InvalidInvoiceItemError(
        `Item "${description}" requires a unit code.`,
      );
    }

    const taxableAmount = params.unitValue.multiplyBy(params.quantity);
    const applies = params.affectation.isTaxed();
    // Exonerated/unaffected lines carry no IGV; the unit price equals the net value.
    const igv = applies
      ? taxableAmount.multiplyBy(IGV_RATE)
      : Money.zero(taxableAmount.currency);
    const unitPrice = applies
      ? params.unitValue.multiplyBy(IGV_MULTIPLIER)
      : params.unitValue;
    const total = taxableAmount.add(igv);

    return new InvoiceItem(
      params.code?.trim() || undefined,
      description,
      unitCode,
      params.quantity,
      params.unitValue,
      params.affectation,
      taxableAmount,
      igv,
      unitPrice,
      total,
    );
  }
}
