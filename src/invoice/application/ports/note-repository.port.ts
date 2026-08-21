import { Note } from '../../domain/aggregates/note';
import type { InvoiceStatus, SunatOutcome } from './invoice-repository.port';

/** Persisted view of a note: the aggregate plus submission state. */
export interface StoredNote {
  readonly note: Note;
  readonly status: InvoiceStatus;
  readonly sunat?: {
    readonly fileName: string;
    readonly responseCode: string;
    readonly description: string;
    readonly notes: ReadonlyArray<string>;
  };
}

/** Port: credit/debit note persistence. */
export interface NoteRepository {
  save(note: Note): Promise<void>;
  findById(id: string): Promise<StoredNote | null>;
  existsSeriesCorrelative(
    issuerRuc: string,
    documentType: string,
    series: string,
    correlative: number,
  ): Promise<boolean>;
  recordSunatOutcome(id: string, outcome: SunatOutcome): Promise<void>;
}

export const NOTE_REPOSITORY = Symbol('NoteRepository');
