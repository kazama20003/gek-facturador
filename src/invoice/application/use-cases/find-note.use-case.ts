import { NoteNotFoundError } from '../../domain/errors/invoice-errors';
import type { InvoiceStatus } from '../ports/invoice-repository.port';
import type { NoteRepository } from '../ports/note-repository.port';
import { serializeNote, type CreateNoteResult } from './create-note.use-case';

export interface FindNoteResult extends CreateNoteResult {
  status: InvoiceStatus;
  sunat?: {
    fileName: string;
    responseCode: string;
    description: string;
    notes: ReadonlyArray<string>;
  };
}

/** Returns a persisted note with its SUNAT submission state. */
export class FindNoteUseCase {
  constructor(private readonly notes: NoteRepository) {}

  async execute(id: string): Promise<FindNoteResult> {
    const stored = await this.notes.findById(id);
    if (!stored) {
      throw new NoteNotFoundError(id);
    }
    return {
      ...serializeNote(stored.note),
      status: stored.status,
      sunat: stored.sunat,
    };
  }
}
