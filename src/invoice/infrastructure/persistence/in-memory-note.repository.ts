import type {
  InvoiceStatus,
  SunatOutcome,
} from '../../application/ports/invoice-repository.port';
import type {
  NoteRepository,
  StoredNote,
} from '../../application/ports/note-repository.port';
import { Note } from '../../domain/aggregates/note';

interface Entry {
  note: Note;
  status: InvoiceStatus;
  sunat?: StoredNote['sunat'];
}

/** Volatile note repository for tests and DB-less development. */
export class InMemoryNoteRepository implements NoteRepository {
  private readonly entries = new Map<string, Entry>();

  save(note: Note): Promise<void> {
    this.entries.set(note.id, { note, status: 'ISSUED' });
    return Promise.resolve();
  }

  findById(id: string): Promise<StoredNote | null> {
    const entry = this.entries.get(id);
    return Promise.resolve(entry ? { ...entry } : null);
  }

  existsSeriesCorrelative(
    issuerRuc: string,
    documentType: string,
    series: string,
    correlative: number,
  ): Promise<boolean> {
    for (const { note } of this.entries.values()) {
      if (
        note.issuer.ruc.toString() === issuerRuc &&
        note.documentType === documentType &&
        note.series.toString() === series &&
        note.correlative.toNumber() === correlative
      ) {
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(false);
  }

  recordSunatOutcome(id: string, outcome: SunatOutcome): Promise<void> {
    const entry = this.entries.get(id);
    if (entry) {
      entry.status = outcome.cdr.accepted ? 'ACCEPTED' : 'REJECTED';
      entry.sunat = {
        fileName: outcome.fileName,
        responseCode: outcome.cdr.responseCode,
        description: outcome.cdr.description,
        notes: outcome.cdr.notes,
      };
    }
    return Promise.resolve();
  }
}
