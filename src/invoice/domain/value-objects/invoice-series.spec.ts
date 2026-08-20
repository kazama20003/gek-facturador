import { InvalidInvoiceSeriesError } from '../errors/invoice-errors';
import { InvoiceSeries } from './invoice-series';

describe('InvoiceSeries', () => {
  it('accepts F001 and normalizes to uppercase', () => {
    expect(InvoiceSeries.create('F001').toString()).toBe('F001');
    expect(InvoiceSeries.create('f001').toString()).toBe('F001');
  });

  it('rejects series not starting with F', () => {
    expect(() => InvoiceSeries.create('B001')).toThrow(
      InvalidInvoiceSeriesError,
    );
  });

  it('rejects wrong length', () => {
    expect(() => InvoiceSeries.create('F01')).toThrow(
      InvalidInvoiceSeriesError,
    );
    expect(() => InvoiceSeries.create('F0001')).toThrow(
      InvalidInvoiceSeriesError,
    );
  });
});
