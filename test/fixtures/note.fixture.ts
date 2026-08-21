import type { CreateNoteCommand } from '../../src/invoice/application/use-cases/create-note.use-case';

/** Stable note fixture: credit/debit F001-1 modifying invoice F001-1 (S/118). */
export const fixtureNoteRequestBody: CreateNoteCommand = {
  series: 'F001',
  correlative: 1,
  issueDate: '2026-08-20',
  currency: 'PEN',
  reasonCode: '01',
  modifies: { series: 'F001', correlative: 1 },
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
