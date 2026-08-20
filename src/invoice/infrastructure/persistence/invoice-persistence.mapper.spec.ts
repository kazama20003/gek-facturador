import { fixtureInvoice } from '../../../../test/fixtures/invoice.fixture';
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
