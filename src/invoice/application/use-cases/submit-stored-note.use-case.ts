import { NoteNotFoundError } from '../../domain/errors/invoice-errors';
import type { NoteRepository } from '../ports/note-repository.port';
import {
  SendNoteToSunatUseCase,
  type SendNoteToSunatResult,
} from './send-note-to-sunat.use-case';

/** Loads a persisted note, submits it to SUNAT and records the CDR outcome. */
export class SubmitStoredNoteUseCase {
  constructor(
    private readonly notes: NoteRepository,
    private readonly sendToSunat: SendNoteToSunatUseCase,
  ) {}

  async execute(id: string): Promise<SendNoteToSunatResult> {
    const stored = await this.notes.findById(id);
    if (!stored) {
      throw new NoteNotFoundError(id);
    }
    const result = await this.sendToSunat.execute(stored.note);
    await this.notes.recordSunatOutcome(id, result);
    return result;
  }
}
