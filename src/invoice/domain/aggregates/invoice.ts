import { InvoiceItem } from '../entities/invoice-item';
import {
  CurrencyMismatchError,
  InvalidInvoiceItemError,
  InvalidInvoiceSeriesError,
  InvalidPartyError,
  InvoiceWithoutItemsError,
} from '../errors/invoice-errors';
import { IGV_RATE } from '../services/igv';
import { Correlative } from '../value-objects/correlative';
import { Currency } from '../value-objects/currency';
import { Money } from '../value-objects/money';
import { Party } from '../value-objects/party';
import { Quantity } from '../value-objects/quantity';
import { InvoiceSeries } from '../value-objects/invoice-series';
import { Detraction } from '../value-objects/detraction';
import { IgvAffectationType } from '../value-objects/igv-affectation-type';
import { PaymentTerms } from '../value-objects/payment-terms';

/** SUNAT catalog 01 — document types handled by this aggregate. */
export const INVOICE_DOCUMENT_TYPE = '01';
export const BOLETA_DOCUMENT_TYPE = '03';
export type SaleDocumentType =
  typeof INVOICE_DOCUMENT_TYPE | typeof BOLETA_DOCUMENT_TYPE;

/**
 * Aggregate root for a basic taxed sale document: factura (01) or boleta (03).
 * Totals are always derived from the items; there are no setters.
 * Invariants: facturas use F-series and a RUC-identified customer;
 * boletas use B-series (customer may be RUC or DNI).
 */
export class Invoice {
  private readonly items: InvoiceItem[] = [];
  private _globalDiscount?: Money;
  private _detraction?: Detraction;

  private constructor(
    readonly id: string,
    private readonly _documentType: SaleDocumentType,
    readonly series: InvoiceSeries,
    readonly correlative: Correlative,
    readonly issueDate: Date,
    readonly currency: Currency,
    readonly issuer: Party,
    readonly customer: Party,
    readonly paymentTerms: PaymentTerms,
  ) {}

  static create(params: {
    id: string;
    documentType?: SaleDocumentType;
    series: InvoiceSeries;
    correlative: Correlative;
    issueDate: Date;
    currency: Currency;
    issuer: Party;
    customer: Party;
    paymentTerms?: PaymentTerms;
  }): Invoice {
    const documentType = params.documentType ?? INVOICE_DOCUMENT_TYPE;

    const expectedPrefix = documentType === INVOICE_DOCUMENT_TYPE ? 'F' : 'B';
    if (!params.series.startsWith(expectedPrefix)) {
      throw new InvalidInvoiceSeriesError(
        `Document type ${documentType} requires a series starting with "${expectedPrefix}": "${params.series.toString()}".`,
      );
    }
    if (
      documentType === INVOICE_DOCUMENT_TYPE &&
      !params.customer.identity.isRuc
    ) {
      throw new InvalidPartyError(
        'Invoices (01) require a RUC-identified customer.',
      );
    }
    if (!params.issuer.identity.isRuc) {
      throw new InvalidPartyError('The issuer must be identified with a RUC.');
    }

    return new Invoice(
      params.id,
      documentType,
      params.series,
      params.correlative,
      params.issueDate,
      params.currency,
      params.issuer,
      params.customer,
      params.paymentTerms ?? PaymentTerms.cash(),
    );
  }

  addTaxableItem(params: {
    code?: string;
    description: string;
    unitCode: string;
    quantity: Quantity;
    unitValue: Money;
  }): void {
    this.addItem({
      ...params,
      affectation: IgvAffectationType.TAXED_OPERATION,
    });
  }

  addItem(params: {
    code?: string;
    description: string;
    unitCode: string;
    quantity: Quantity;
    unitValue: Money;
    affectation: IgvAffectationType;
    discount?: Money;
  }): void {
    if (params.unitValue.currency !== this.currency) {
      throw new CurrencyMismatchError(
        `Item currency ${params.unitValue.currency} does not match invoice currency ${this.currency}.`,
      );
    }
    this.items.push(InvoiceItem.create(params));
  }

  /**
   * Global discount (SUNAT catalog 53 code 02): reduces the taxed base and
   * therefore the IGV. Must not exceed the raw taxed base.
   */
  applyGlobalDiscount(amount: Money): void {
    if (amount.currency !== this.currency) {
      throw new CurrencyMismatchError(
        `Discount currency ${amount.currency} does not match invoice currency ${this.currency}.`,
      );
    }
    if (Number(amount.toFixed()) > Number(this.rawTaxedBase.toFixed())) {
      throw new InvalidInvoiceItemError(
        `Global discount (${amount.toFixed()}) cannot exceed the taxed base (${this.rawTaxedBase.toFixed()}).`,
      );
    }
    this._globalDiscount = amount;
  }

  get globalDiscount(): Money {
    return this._globalDiscount ?? Money.zero(this.currency);
  }

  /** Attaches a SPOT detraction (catalog 54). Amount is derived from the total. */
  applyDetraction(params: {
    code: string;
    percent: string;
    account: string;
  }): void {
    this._detraction = Detraction.create({ ...params, total: this.total });
  }

  get detraction(): Detraction | undefined {
    return this._detraction;
  }

  /** Validates issuing invariants. Kept minimal: no SUNAT states yet. */
  issue(): void {
    if (this.items.length === 0) {
      throw new InvoiceWithoutItemsError();
    }
  }

  get documentType(): SaleDocumentType {
    return this._documentType;
  }

  /** Defensive copy — the internal collection cannot be mutated from outside. */
  get lines(): readonly InvoiceItem[] {
    return [...this.items];
  }

  private sumWhere(predicate: (item: InvoiceItem) => boolean): Money {
    return this.items
      .filter(predicate)
      .reduce(
        (acc, item) => acc.add(item.taxableAmount),
        Money.zero(this.currency),
      );
  }

  /** Taxed base before the global discount (sum of net taxed lines). */
  private get rawTaxedBase(): Money {
    return this.sumWhere(
      (i) => i.affectation === IgvAffectationType.TAXED_OPERATION,
    );
  }

  /** Total de operaciones gravadas (base imponible afecta, neta del descuento global). */
  get taxableAmount(): Money {
    return this.rawTaxedBase.subtract(this.globalDiscount);
  }

  /** Total de operaciones exoneradas (código 20). */
  get exoneratedAmount(): Money {
    return this.sumWhere(
      (i) => i.affectation === IgvAffectationType.EXONERATED,
    );
  }

  /** Total de operaciones inafectas (código 30). */
  get unaffectedAmount(): Money {
    return this.sumWhere(
      (i) => i.affectation === IgvAffectationType.UNAFFECTED,
    );
  }

  /** Valor referencial total de líneas gratuitas (código 11). */
  get freeAmount(): Money {
    return this.items
      .filter((i) => i.isFree)
      .reduce((acc, i) => acc.add(i.referenceValue), Money.zero(this.currency));
  }

  /** IGV referencial de las líneas gratuitas (no se cobra). */
  get freeIgv(): Money {
    return this.items
      .filter((i) => i.isFree)
      .reduce((acc, i) => acc.add(i.igv), Money.zero(this.currency));
  }

  /** IGV de las operaciones onerosas (excluye gratuitas), sobre la base con descuento. */
  get igv(): Money {
    return this.taxableAmount.multiplyBy(IGV_RATE);
  }

  /** Suma de bases de línea (antes del descuento global) — LineExtensionAmount del total. */
  get lineExtensionTotal(): Money {
    return this.rawTaxedBase
      .add(this.exoneratedAmount)
      .add(this.unaffectedAmount);
  }

  /** Valor de venta — bases onerosas (gravada con descuento + exonerada + inafecta). */
  get saleValue(): Money {
    return this.taxableAmount
      .add(this.exoneratedAmount)
      .add(this.unaffectedAmount);
  }

  /** Importe total a pagar — valor de venta más IGV (las gratuitas no suman). */
  get total(): Money {
    return this.saleValue.add(this.igv);
  }
}
