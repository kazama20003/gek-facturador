import { InvoiceItem } from './invoice-item';
import { Money } from '../value-objects/money';
import { Quantity } from '../value-objects/quantity';

function taxedItem(quantity: string, unitValue: string) {
  return InvoiceItem.createTaxed({
    description: 'Servicio de transporte',
    unitCode: 'ZZ',
    quantity: Quantity.create(quantity),
    unitValue: Money.pen(unitValue),
  });
}

describe('InvoiceItem', () => {
  it('computes S/100 + 18% IGV = S/118', () => {
    const item = taxedItem('1', '100.00');
    expect(item.taxableAmount.toFixed()).toBe('100.00');
    expect(item.igv.toFixed()).toBe('18.00');
    expect(item.unitPrice.toFixed()).toBe('118.00');
    expect(item.total.toFixed()).toBe('118.00');
  });

  it('scales with quantity greater than one', () => {
    const item = taxedItem('3', '50.00');
    expect(item.taxableAmount.toFixed()).toBe('150.00');
    expect(item.igv.toFixed()).toBe('27.00');
    expect(item.total.toFixed()).toBe('177.00');
  });

  it('handles decimal quantities and unit values', () => {
    const item = taxedItem('2.5', '10.40');
    expect(item.taxableAmount.toFixed()).toBe('26.00');
    expect(item.igv.toFixed()).toBe('4.68');
    expect(item.total.toFixed()).toBe('30.68');
  });

  it('rounds half-up at each derived amount', () => {
    // base = 3 * 33.33 = 99.99; igv = 17.9982 -> 18.00; unitPrice = 39.3294 -> 39.33
    const item = taxedItem('3', '33.33');
    expect(item.taxableAmount.toFixed()).toBe('99.99');
    expect(item.igv.toFixed()).toBe('18.00');
    expect(item.unitPrice.toFixed()).toBe('39.33');
    expect(item.total.toFixed()).toBe('117.99');
  });
});
