import { InvalidNoteReasonError } from '../errors/invoice-errors';
import { NoteType } from './note-type.enum';

/** SUNAT catalog 09 — credit note reasons. */
const CREDIT_REASONS: Record<string, string> = {
  '01': 'Anulacion de la operacion',
  '02': 'Anulacion por error en el RUC',
  '03': 'Correccion por error en la descripcion',
  '04': 'Descuento global',
  '05': 'Descuento por item',
  '06': 'Devolucion total',
  '07': 'Devolucion por item',
  '08': 'Bonificacion',
  '09': 'Disminucion en el valor',
  '10': 'Otros conceptos',
  '13': 'Ajustes - montos y/o fechas de pago',
};

/** SUNAT catalog 10 — debit note reasons. */
const DEBIT_REASONS: Record<string, string> = {
  '01': 'Intereses por mora',
  '02': 'Aumento en el valor',
  '03': 'Penalidades / otros conceptos',
};

/**
 * Reason for issuing a note. The SUNAT code stays inside the value object;
 * the free-text description travels to the XML DiscrepancyResponse.
 */
export class NoteReason {
  private constructor(
    readonly code: string,
    readonly description: string,
  ) {}

  static create(
    noteType: NoteType,
    code: string,
    description?: string,
  ): NoteReason {
    const catalog =
      noteType === NoteType.Credit ? CREDIT_REASONS : DEBIT_REASONS;
    const catalogName = noteType === NoteType.Credit ? '09' : '10';
    const canonical = catalog[code];
    if (!canonical) {
      throw new InvalidNoteReasonError(
        `Invalid reason code "${code}" for SUNAT catalog ${catalogName}.`,
      );
    }
    return new NoteReason(code, description?.trim() || canonical);
  }
}
