import {
  CreateInvoiceUseCase,
  type CreateInvoiceCommand,
} from './create-invoice.use-case';
import {
  DuplicateInvoiceError,
  InvalidRucError,
} from '../../domain/errors/invoice-errors';
import { InMemoryInvoiceRepository } from '../../infrastructure/persistence/in-memory-invoice.repository';

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
  function makeUseCase(): CreateInvoiceUseCase {
    return new CreateInvoiceUseCase(new InMemoryInvoiceRepository());
  }

  it('creates a complete invoice with correct totals', async () => {
    const result = await makeUseCase().execute(validCommand());

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

  it('returns a JSON-serializable result', async () => {
    const result = await makeUseCase().execute(validCommand());
    expect(() => JSON.stringify(result)).not.toThrow();
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('propagates domain errors', async () => {
    const command = validCommand();
    command.issuer.ruc = '20123456789'; // bad check digit
    await expect(makeUseCase().execute(command)).rejects.toThrow(
      InvalidRucError,
    );
  });

  it('persists the invoice and rejects a duplicated series+correlative', async () => {
    const repo = new InMemoryInvoiceRepository();
    const useCase = new CreateInvoiceUseCase(repo);

    const first = await useCase.execute(validCommand());
    const stored = await repo.findById(first.id);
    expect(stored?.status).toBe('ISSUED');
    expect(stored?.invoice.total.toFixed()).toBe('118.00');

    await expect(useCase.execute(validCommand())).rejects.toThrow(
      DuplicateInvoiceError,
    );
  });
});
