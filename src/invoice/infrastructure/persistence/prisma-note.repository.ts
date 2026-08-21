import type {
  InvoiceStatus,
  SunatOutcome,
} from '../../application/ports/invoice-repository.port';
import type {
  NoteRepository,
  StoredNote,
} from '../../application/ports/note-repository.port';
import { Note } from '../../domain/aggregates/note';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma.service';
import { NotePersistenceMapper } from './note-persistence.mapper';

/** PostgreSQL adapter for the NoteRepository port. */
export class PrismaNoteRepository implements NoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(note: Note): Promise<void> {
    await this.prisma.note.create({ data: NotePersistenceMapper.toRow(note) });
  }

  async findById(id: string): Promise<StoredNote | null> {
    const row = await this.prisma.note.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!row) return null;
    return {
      note: NotePersistenceMapper.toAggregate(row),
      status: row.status as InvoiceStatus,
      sunat: row.cdr_response_code
        ? {
            fileName: row.sunat_file_name ?? '',
            responseCode: row.cdr_response_code,
            description: row.cdr_description ?? '',
            notes: row.cdr_notes,
          }
        : undefined,
    };
  }

  async existsSeriesCorrelative(
    issuerRuc: string,
    documentType: string,
    series: string,
    correlative: number,
  ): Promise<boolean> {
    const count = await this.prisma.note.count({
      where: {
        issuer_ruc: issuerRuc,
        document_type: documentType,
        series,
        correlative,
      },
    });
    return count > 0;
  }

  async recordSunatOutcome(id: string, outcome: SunatOutcome): Promise<void> {
    await this.prisma.note.update({
      where: { id },
      data: {
        status: outcome.cdr.accepted ? 'ACCEPTED' : 'REJECTED',
        sunat_file_name: outcome.fileName,
        cdr_response_code: outcome.cdr.responseCode,
        cdr_description: outcome.cdr.description,
        cdr_notes: [...outcome.cdr.notes],
        cdr_zip_base64: outcome.cdrZipBase64,
        signed_xml: outcome.signedXml,
      },
    });
  }
}
