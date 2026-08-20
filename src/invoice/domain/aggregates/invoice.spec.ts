import { Invoice } from './invoice';
import {
  CurrencyMismatchError,
  InvoiceWithoutItemsError,
} from '../errors/invoice-errors';
import { Correlative } from '../value-objects/correlative';
import { Currency } from '../value-objects/currency';
import { InvoiceSeries } from '../value-objects/invoice-series';
import { Money } from '../value-objects/money';
import { Party } from '../value-objects/party';
import { Quantity } from '../value-objects/quantity';
import { Ruc } from '../value-objects/ruc';

function emptyInvoice(): Invoice {
  return Invoice.create({
    id: 'inv-1',
    series: InvoiceSeries.create('F001'),
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
  });
}

function addItem(invoice: Invoice, unitValue: string, quantity = '1'): void {
  invoice.addTaxableItem({
    description: 'Servicio de transporte',
    unitCode: 'ZZ',
    quantity: Quantity.create(quantity),
    unitValue: Money.pen(unitValue),
  });
}

describe('Invoice', () => {
  it('issues a valid invoice with one item and correct totals', () => {
    const invoice = emptyInvoice();
    addItem(invoice, '100.00');
    invoice.issue();

    expect(invoice.documentType).toBe('01');
    expect(invoice.taxableAmount.toFixed()).toBe('100.00');
    expect(invoice.igv.toFixed()).toBe('18.00');
    expect(invoice.saleValue.toFixed()).toBe('100.00');
    expect(invoice.total.toFixed()).toBe('118.00');
  });

  it('sums totals across several items', () => {
    const invoice = emptyInvoice();
    addItem(invoice, '100.00');
    addItem(invoice, '50.00', '2');
    invoice.issue();

    expect(invoice.taxableAmount.toFixed()).toBe('200.00');
    expect(invoice.igv.toFixed()).toBe('36.00');
    expect(invoice.total.toFixed()).toBe('236.00');
  });

  it('rejects issuing without items', () => {
    expect(() => emptyInvoice().issue()).toThrow(InvoiceWithoutItemsError);
  });

  it('rejects items in a different currency', () => {
    const invoice = emptyInvoice();
    expect(() =>
      invoice.addTaxableItem({
        description: 'Item',
        unitCode: 'ZZ',
        quantity: Quantity.create('1'),
        unitValue: Money.usd('10.00'),
      }),
    ).toThrow(CurrencyMismatchError);
  });

  it('protects the internal item collection', () => {
    const invoice = emptyInvoice();
    addItem(invoice, '100.00');

    const lines = invoice.lines as unknown[];
    lines.pop();
    expect(invoice.lines).toHaveLength(1);
  });
});
