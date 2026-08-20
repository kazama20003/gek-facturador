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

  static createTaxed(params: {
    code?: string;
    description: string;
    unitCode: string;
    quantity: Quantity;
    unitValue: Money;
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
    const igv = taxableAmount.multiplyBy(IGV_RATE);
    const unitPrice = params.unitValue.multiplyBy(IGV_MULTIPLIER);
    const total = taxableAmount.add(igv);

    return new InvoiceItem(
      params.code?.trim() || undefined,
      description,
      unitCode,
      params.quantity,
      params.unitValue,
      IgvAffectationType.TAXED_OPERATION,
      taxableAmount,
      igv,
      unitPrice,
      total,
    );
  }
}
