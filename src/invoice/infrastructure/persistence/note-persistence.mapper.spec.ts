import { fixtureNoteRequestBody } from '../../../../test/fixtures/note.fixture';
import { CreateNoteUseCase } from '../../application/use-cases/create-note.use-case';
import { NoteType } from '../../domain/value-objects/note-type.enum';
import { InMemoryNoteRepository } from './in-memory-note.repository';
import { NotePersistenceMapper } from './note-persistence.mapper';

describe('NotePersistenceMapper', () => {
  const note = new CreateNoteUseCase(
    new InMemoryNoteRepository(),
  ).buildAggregate(NoteType.Credit, fixtureNoteRequestBody);

  it('maps the aggregate to a row with reference and reason', () => {
    const row = NotePersistenceMapper.toRow(note);
    expect(row).toMatchObject({
      document_type: '07',
      series: 'F001',
      reason_code: '01',
      reason_description: 'Anulacion de la operacion',
      modified_document_type: '01',
      modified_series: 'F001',
      modified_correlative: 1,
      taxable_amount: '100.00',
      total: '118.00',
      status: 'ISSUED',
    });
  });

  it('round-trips: row -> aggregate re-runs invariants and totals match', () => {
    const row = NotePersistenceMapper.toRow(note);
    const rebuilt = NotePersistenceMapper.toAggregate({
      ...(row as never as Record<string, unknown>),
      issue_date: note.issueDate,
      items: [
        {
          id: 'i1',
          id_note: note.id,
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
    } as never);

    expect(rebuilt.documentType).toBe('07');
    expect(rebuilt.total.toFixed()).toBe('118.00');
    expect(rebuilt.modifies.id).toBe('F001-1');
    expect(rebuilt.reason.code).toBe('01');
  });
});
