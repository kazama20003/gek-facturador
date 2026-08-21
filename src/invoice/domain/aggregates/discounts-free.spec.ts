import { Invoice } from './invoice';
import { Correlative } from '../value-objects/correlative';
import { Currency } from '../value-objects/currency';
import { IgvAffectationType } from '../value-objects/igv-affectation-type';
import { InvalidInvoiceItemError } from '../errors/invoice-errors';
import { InvoiceSeries } from '../value-objects/invoice-series';
import { Money } from '../value-objects/money';
import { Party } from '../value-objects/party';
import { Quantity } from '../value-objects/quantity';
import { Ruc } from '../value-objects/ruc';

function baseInvoice(): Invoice {
  return Invoice.create({
    id: 'x',
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

describe('Line discount', () => {
  it('reduces the line base and IGV', () => {
    const invoice = baseInvoice();
    invoice.addItem({
      description: 'Item',
      unitCode: 'ZZ',
      quantity: Quantity.create('1'),
      unitValue: Money.pen('100.00'),
      affectation: IgvAffectationType.TAXED_OPERATION,
      discount: Money.pen('20.00'),
    });
    invoice.issue();
    const line = invoice.lines[0];
    expect(line.taxableAmount.toFixed()).toBe('80.00');
    expect(line.igv.toFixed()).toBe('14.40');
    expect(line.total.toFixed()).toBe('94.40');
  });
});

describe('Global discount', () => {
  it('reduces the taxed base and IGV; totals reconcile', () => {
    const invoice = baseInvoice();
    invoice.addItem({
      description: 'Item',
      unitCode: 'ZZ',
      quantity: Quantity.create('1'),
      unitValue: Money.pen('100.00'),
      affectation: IgvAffectationType.TAXED_OPERATION,
    });
    invoice.applyGlobalDiscount(Money.pen('10.00'));
    invoice.issue();

    expect(invoice.taxableAmount.toFixed()).toBe('90.00');
    expect(invoice.igv.toFixed()).toBe('16.20');
    expect(invoice.total.toFixed()).toBe('106.20');
  });

  it('rejects a discount larger than the taxed base', () => {
    const invoice = baseInvoice();
    invoice.addItem({
      description: 'Item',
      unitCode: 'ZZ',
      quantity: Quantity.create('1'),
      unitValue: Money.pen('100.00'),
      affectation: IgvAffectationType.TAXED_OPERATION,
    });
    expect(() => invoice.applyGlobalDiscount(Money.pen('150.00'))).toThrow(
      InvalidInvoiceItemError,
    );
  });
});

describe('Free transfer (código 11)', () => {
  it('does not add to the payable total but carries a referential value and IGV', () => {
    const invoice = baseInvoice();
    invoice.addItem({
      description: 'Servicio gravado',
      unitCode: 'ZZ',
      quantity: Quantity.create('1'),
      unitValue: Money.pen('100.00'),
      affectation: IgvAffectationType.TAXED_OPERATION,
    });
    invoice.addItem({
      description: 'Muestra gratis',
      unitCode: 'ZZ',
      quantity: Quantity.create('1'),
      unitValue: Money.pen('50.00'),
      affectation: IgvAffectationType.FREE_TAXED,
    });
    invoice.issue();

    expect(invoice.taxableAmount.toFixed()).toBe('100.00');
    expect(invoice.igv.toFixed()).toBe('18.00'); // only the onerous line
    expect(invoice.total.toFixed()).toBe('118.00'); // free line excluded
    expect(invoice.freeAmount.toFixed()).toBe('50.00');
    expect(invoice.freeIgv.toFixed()).toBe('9.00');

    const freeLine = invoice.lines[1];
    expect(freeLine.isFree).toBe(true);
    expect(freeLine.total.toFixed()).toBe('0.00');
    expect(freeLine.unitPrice.toFixed()).toBe('0.00');
    expect(freeLine.referenceValue.toFixed()).toBe('50.00');
  });
});
