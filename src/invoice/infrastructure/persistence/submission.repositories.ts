import type {
  SubmissionRecord,
  SubmissionRepository,
} from '../../application/ports/submission-repository.port';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma.service';

/** PostgreSQL adapter for the SubmissionRepository port. */
export class PrismaSubmissionRepository implements SubmissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: SubmissionRecord): Promise<void> {
    await this.prisma.sunat_submission.create({
      data: {
        kind: entry.kind,
        document_id: entry.documentId,
        file_name: entry.fileName,
        ticket: entry.ticket,
        status_code: entry.statusCode,
        cdr_response_code: entry.cdr?.responseCode ?? null,
        cdr_description: entry.cdr?.description ?? null,
        cdr_notes: entry.cdr ? [...entry.cdr.notes] : [],
        cdr_zip_base64: entry.cdrZipBase64 ?? null,
        signed_xml: entry.signedXml,
      },
    });
  }

  async findByDocumentId(documentId: string): Promise<SubmissionRecord | null> {
    const row = await this.prisma.sunat_submission.findFirst({
      where: { document_id: documentId },
      orderBy: { created_at: 'desc' },
    });
    if (!row) return null;
    return {
      kind: row.kind as 'RC' | 'RA',
      documentId: row.document_id,
      fileName: row.file_name,
      ticket: row.ticket,
      statusCode: row.status_code,
      cdr: row.cdr_response_code
        ? {
            responseCode: row.cdr_response_code,
            description: row.cdr_description ?? '',
            notes: row.cdr_notes,
            accepted: row.cdr_response_code === '0',
          }
        : undefined,
      cdrZipBase64: row.cdr_zip_base64 ?? undefined,
      signedXml: row.signed_xml ?? '',
    };
  }
}

/** Volatile adapter for tests and DB-less development. */
export class InMemorySubmissionRepository implements SubmissionRepository {
  readonly entries: SubmissionRecord[] = [];

  record(entry: SubmissionRecord): Promise<void> {
    this.entries.push(entry);
    return Promise.resolve();
  }

  findByDocumentId(documentId: string): Promise<SubmissionRecord | null> {
    const found = [...this.entries]
      .reverse()
      .find((e) => e.documentId === documentId);
    return Promise.resolve(found ?? null);
  }
}
