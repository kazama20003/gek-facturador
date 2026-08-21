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
    readonly discount: Money,
    /** Reference value for free lines (código 11); zero otherwise. */
    readonly referenceValue: Money,
    readonly taxableAmount: Money,
    readonly igv: Money,
    readonly unitPrice: Money,
    readonly total: Money,
  ) {}

  get isFree(): boolean {
    return this.affectation.isFree;
  }

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
    /** Optional line discount, applied to the gross before IGV. */
    discount?: Money;
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

    const currency = params.unitValue.currency;
    const gross = params.unitValue.multiplyBy(params.quantity);
    const discount = params.discount ?? Money.zero(currency);
    const applies = params.affectation.isTaxed();

    if (params.affectation.isFree) {
      // Free transfer (código 11): customer pays nothing; SUNAT wants the
      // reference value and a referential IGV under tax scheme 9996 (GRA).
      const referenceValue = gross;
      const igv = referenceValue.multiplyBy(IGV_RATE);
      return new InvoiceItem(
        params.code?.trim() || undefined,
        description,
        unitCode,
        params.quantity,
        params.unitValue,
        params.affectation,
        Money.zero(currency),
        referenceValue,
        Money.zero(currency), // taxable base does not count toward the sale
        igv,
        Money.zero(currency), // unit price is zero (free)
        Money.zero(currency),
      );
    }

    const net = gross.subtract(discount);
    const igv = applies ? net.multiplyBy(IGV_RATE) : Money.zero(currency);
    const unitPrice = applies
      ? params.unitValue.multiplyBy(IGV_MULTIPLIER)
      : params.unitValue;
    const total = net.add(igv);

    return new InvoiceItem(
      params.code?.trim() || undefined,
      description,
      unitCode,
      params.quantity,
      params.unitValue,
      params.affectation,
      discount,
      Money.zero(currency),
      net,
      igv,
      unitPrice,
      total,
    );
  }
}
