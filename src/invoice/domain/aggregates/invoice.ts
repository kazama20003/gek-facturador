import { InvoiceItem } from '../entities/invoice-item';
import {
  CurrencyMismatchError,
  InvalidInvoiceSeriesError,
  InvalidPartyError,
  InvoiceWithoutItemsError,
} from '../errors/invoice-errors';
import { Correlative } from '../value-objects/correlative';
import { Currency } from '../value-objects/currency';
import { Money } from '../value-objects/money';
import { Party } from '../value-objects/party';
import { Quantity } from '../value-objects/quantity';
import { InvoiceSeries } from '../value-objects/invoice-series';

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

  private constructor(
    readonly id: string,
    private readonly _documentType: SaleDocumentType,
    readonly series: InvoiceSeries,
    readonly correlative: Correlative,
    readonly issueDate: Date,
    readonly currency: Currency,
    readonly issuer: Party,
    readonly customer: Party,
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
    );
  }

  addTaxableItem(params: {
    code?: string;
    description: string;
    unitCode: string;
    quantity: Quantity;
    unitValue: Money;
  }): void {
    if (params.unitValue.currency !== this.currency) {
      throw new CurrencyMismatchError(
        `Item currency ${params.unitValue.currency} does not match invoice currency ${this.currency}.`,
      );
    }
    this.items.push(InvoiceItem.createTaxed(params));
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

  /** Sum of taxable bases (total de operaciones gravadas). */
  get taxableAmount(): Money {
    return this.items.reduce(
      (acc, item) => acc.add(item.taxableAmount),
      Money.zero(this.currency),
    );
  }

  get igv(): Money {
    return this.items.reduce(
      (acc, item) => acc.add(item.igv),
      Money.zero(this.currency),
    );
  }

  /** Valor de venta — equals the taxable amount for a purely taxed invoice. */
  get saleValue(): Money {
    return this.taxableAmount;
  }

  /** Importe total — taxable amount plus IGV. */
  get total(): Money {
    return this.taxableAmount.add(this.igv);
  }
}
