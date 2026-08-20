import {
  CreateInvoiceUseCase,
  type CreateInvoiceCommand,
} from './create-invoice.use-case';
import { InvalidRucError } from '../../domain/errors/invoice-errors';

function validCommand(): CreateInvoiceCommand {
  return {
    series: 'F001',
    correlative: 1,
    issueDate: '2026-08-20',
    currency: 'PEN',
    issuer: { ruc: '20000000001', businessName: 'EMITEC SAC' },
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
}

describe('CreateInvoiceUseCase', () => {
  const useCase = new CreateInvoiceUseCase();

  it('creates a complete invoice with correct totals', () => {
    const result = useCase.execute(validCommand());

    expect(result.documentType).toBe('01');
    expect(result.series).toBe('F001');
    expect(result.correlative).toBe(1);
    expect(result.currency).toBe('PEN');
    expect(result.taxableAmount).toBe('100.00');
    expect(result.igv).toBe('18.00');
    expect(result.saleValue).toBe('100.00');
    expect(result.total).toBe('118.00');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].unitPrice).toBe('118.00');
  });

  it('returns a JSON-serializable result', () => {
    const result = useCase.execute(validCommand());
    expect(() => JSON.stringify(result)).not.toThrow();
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('propagates domain errors', () => {
    const command = validCommand();
    command.issuer.ruc = '20123456789'; // bad check digit
    expect(() => useCase.execute(command)).toThrow(InvalidRucError);
  });
});
