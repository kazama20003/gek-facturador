import { Invoice } from './invoice';
import { Currency } from '../value-objects/currency';
import { Correlative } from '../value-objects/correlative';
import { IgvAffectationType } from '../value-objects/igv-affectation-type';
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

function add(invoice: Invoice, value: string, affectation: IgvAffectationType) {
  invoice.addItem({
    description: 'Item',
    unitCode: 'ZZ',
    quantity: Quantity.create('1'),
    unitValue: Money.pen(value),
    affectation,
  });
}

describe('IGV affectations', () => {
  it('exonerated/unaffected lines carry no IGV; unit price equals net value', () => {
    const invoice = baseInvoice();
    add(invoice, '100.00', IgvAffectationType.EXONERATED);
    invoice.issue();
    const line = invoice.lines[0];
    expect(line.igv.toFixed()).toBe('0.00');
    expect(line.unitPrice.toFixed()).toBe('100.00');
    expect(line.total.toFixed()).toBe('100.00');
  });

  it('splits totals per category and only taxes the taxed base', () => {
    const invoice = baseInvoice();
    add(invoice, '100.00', IgvAffectationType.TAXED_OPERATION);
    add(invoice, '50.00', IgvAffectationType.EXONERATED);
    add(invoice, '30.00', IgvAffectationType.UNAFFECTED);
    invoice.issue();

    expect(invoice.taxableAmount.toFixed()).toBe('100.00');
    expect(invoice.exoneratedAmount.toFixed()).toBe('50.00');
    expect(invoice.unaffectedAmount.toFixed()).toBe('30.00');
    expect(invoice.igv.toFixed()).toBe('18.00'); // only the taxed base
    expect(invoice.saleValue.toFixed()).toBe('180.00'); // sum of all bases
    expect(invoice.total.toFixed()).toBe('198.00');
  });

  it('maps affectation codes and carries the right tax scheme', () => {
    expect(IgvAffectationType.fromCode('20')).toBe(
      IgvAffectationType.EXONERATED,
    );
    expect(IgvAffectationType.fromCode('30').taxScheme.id).toBe('9998');
    expect(IgvAffectationType.TAXED_OPERATION.taxScheme.id).toBe('1000');
    expect(() => IgvAffectationType.fromCode('99')).toThrow();
  });
});
