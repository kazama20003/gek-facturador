import { Invoice } from '../../src/invoice/domain/aggregates/invoice';
import { Address } from '../../src/invoice/domain/value-objects/address';
import { Correlative } from '../../src/invoice/domain/value-objects/correlative';
import { Currency } from '../../src/invoice/domain/value-objects/currency';
import { InvoiceSeries } from '../../src/invoice/domain/value-objects/invoice-series';
import { Money } from '../../src/invoice/domain/value-objects/money';
import { Party } from '../../src/invoice/domain/value-objects/party';
import { Quantity } from '../../src/invoice/domain/value-objects/quantity';
import { Ruc } from '../../src/invoice/domain/value-objects/ruc';

/** Stable fixture: F001-1, PEN, S/100 + 18% IGV = S/118. Used by unit, golden and e2e tests. */
export function fixtureInvoice(): Invoice {
  const invoice = Invoice.create({
    id: 'fixture-f001-1',
    series: InvoiceSeries.create('F001'),
    correlative: Correlative.create(1),
    issueDate: new Date('2026-08-20T00:00:00.000Z'),
    currency: Currency.PEN,
    issuer: Party.create({
      ruc: Ruc.create('20000000001'),
      businessName: 'EMITEC SAC',
      tradeName: 'EMITEC',
      address: Address.create({
        ubigeo: '150101',
        department: 'LIMA',
        province: 'LIMA',
        district: 'LIMA',
        addressLine: 'AV. EJEMPLO 123',
      }),
    }),
    customer: Party.create({
      ruc: Ruc.create('20100070970'),
      businessName: 'CLIENTE SAC',
    }),
  });
  invoice.addTaxableItem({
    code: 'SERV-001',
    description: 'Servicio de transporte',
    unitCode: 'ZZ',
    quantity: Quantity.create('1'),
    unitValue: Money.pen('100.00'),
  });
  invoice.issue();
  return invoice;
}

export const fixtureRequestBody = {
  series: 'F001',
  correlative: 1,
  issueDate: '2026-08-20',
  currency: 'PEN',
  issuer: {
    ruc: '20000000001',
    businessName: 'EMITEC SAC',
    tradeName: 'EMITEC',
    address: {
      ubigeo: '150101',
      department: 'LIMA',
      province: 'LIMA',
      district: 'LIMA',
      addressLine: 'AV. EJEMPLO 123',
    },
  },
  customer: { ruc: '20100070970', businessName: 'CLIENTE SAC' },
  items: [
    {
      code: 'SERV-001',
      description: 'Servicio de transporte',
      unitCode: 'ZZ',
      quantity: '1',
      unitValue: '100.00',
    },
  ],
};
