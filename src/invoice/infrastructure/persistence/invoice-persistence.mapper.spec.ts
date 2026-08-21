import { fixtureInvoice } from '../../../../test/fixtures/invoice.fixture';
import { Invoice } from '../../domain/aggregates/invoice';
import { Correlative } from '../../domain/value-objects/correlative';
import { Currency } from '../../domain/value-objects/currency';
import { IdentityDocument } from '../../domain/value-objects/identity-document';
import { InvoiceSeries } from '../../domain/value-objects/invoice-series';
import { Money } from '../../domain/value-objects/money';
import { Party } from '../../domain/value-objects/party';
import { Quantity } from '../../domain/value-objects/quantity';
import { Ruc } from '../../domain/value-objects/ruc';
import { InvoicePersistenceMapper } from './invoice-persistence.mapper';

describe('InvoicePersistenceMapper', () => {
  it('maps the aggregate to a row with domain-computed amounts', () => {
    const row = InvoicePersistenceMapper.toRow(fixtureInvoice());

    expect(row).toMatchObject({
      id: 'fixture-f001-1',
      document_type: '01',
      series: 'F001',
      correlative: 1,
      currency: 'PEN',
      issuer_ruc: '20000000001',
      customer_ruc: '20100070970',
      taxable_amount: '100.00',
      igv: '18.00',
      total: '118.00',
      status: 'ISSUED',
    });
  });

  it('round-trips: row -> aggregate re-runs invariants and totals match', () => {
    const original = fixtureInvoice();
    const row = InvoicePersistenceMapper.toRow(original);

    const rebuilt = InvoicePersistenceMapper.toAggregate({
      ...(row as never as Record<string, unknown>),
      issue_date: original.issueDate,
      items: [
        {
          id: 'item-1',
          id_invoice: 'fixture-f001-1',
          line_number: 1,
          code: 'SERV-001',
          description: 'Servicio de transporte',
          unit_code: 'ZZ',
          quantity: '1',
          unit_value: '100.00',
          taxable_amount: '100.00',
          igv: '18.00',
          unit_price: '118.00',
          total: '118.00',
        },
      ],
    });

    expect(rebuilt.id).toBe(original.id);
    expect(rebuilt.total.toFixed()).toBe('118.00');
    expect(rebuilt.igv.toFixed()).toBe('18.00');
    expect(rebuilt.issuer.address?.ubigeo).toBe('150101');
    expect(rebuilt.lines).toHaveLength(1);
  });
});

describe('InvoicePersistenceMapper — boleta with DNI customer', () => {
  it('round-trips document type 03 and the DNI identity', () => {
    const boleta = Invoice.create({
      id: 'boleta-1',
      documentType: '03',
      series: InvoiceSeries.create('B001'),
      correlative: Correlative.create(1),
      issueDate: new Date('2026-08-20T00:00:00.000Z'),
      currency: Currency.PEN,
      issuer: Party.create({
        ruc: Ruc.create('20000000001'),
        businessName: 'EMITEC SAC',
      }),
      customer: Party.withIdentity({
        identity: IdentityDocument.dni('12345678'),
        businessName: 'JUAN PEREZ',
      }),
    });
    boleta.addTaxableItem({
      description: 'Servicio',
      unitCode: 'ZZ',
      quantity: Quantity.create('1'),
      unitValue: Money.pen('100.00'),
    });
    boleta.issue();

    const row = InvoicePersistenceMapper.toRow(boleta);
    expect(row).toMatchObject({
      document_type: '03',
      customer_ruc: '12345678',
      customer_doc_type: '1',
    });

    const rebuilt = InvoicePersistenceMapper.toAggregate({
      ...(row as never as Record<string, unknown>),
      issue_date: boleta.issueDate,
      items: [
        {
          id: 'i1',
          id_invoice: 'boleta-1',
          line_number: 1,
          code: null,
          description: 'Servicio',
          unit_code: 'ZZ',
          quantity: '1',
          unit_value: '100.00',
          taxable_amount: '100.00',
          igv: '18.00',
          unit_price: '118.00',
          total: '118.00',
        },
      ],
    } as never);

    expect(rebuilt.documentType).toBe('03');
    expect(rebuilt.customer.identity.code).toBe('1');
    expect(rebuilt.total.toFixed()).toBe('118.00');
  });
});
