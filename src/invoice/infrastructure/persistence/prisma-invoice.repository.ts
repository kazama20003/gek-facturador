import type {
  InvoiceRepository,
  InvoiceStatus,
  StoredInvoice,
  SunatOutcome,
} from '../../application/ports/invoice-repository.port';
import { Invoice } from '../../domain/aggregates/invoice';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma.service';
import { InvoicePersistenceMapper } from './invoice-persistence.mapper';

/** PostgreSQL adapter for the InvoiceRepository port. */
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(invoice: Invoice): Promise<void> {
    await this.prisma.invoice.create({
      data: InvoicePersistenceMapper.toRow(invoice),
    });
  }

  async findById(id: string): Promise<StoredInvoice | null> {
    const row = await this.prisma.invoice.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!row) return null;

    return {
      invoice: InvoicePersistenceMapper.toAggregate(row),
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
    const count = await this.prisma.invoice.count({
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
    await this.prisma.invoice.update({
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

  async findBoletasByIssueDate(
    issuerRuc: string,
    issueDate: string,
  ): Promise<StoredInvoice[]> {
    const dayStart = new Date(`${issueDate}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const rows = await this.prisma.invoice.findMany({
      where: {
        issuer_ruc: issuerRuc,
        document_type: '03',
        issue_date: { gte: dayStart, lt: dayEnd },
      },
      include: { items: true },
      orderBy: [{ series: 'asc' }, { correlative: 'asc' }],
    });
    return rows.map((row) => ({
      invoice: InvoicePersistenceMapper.toAggregate(row),
      status: row.status as InvoiceStatus,
      sunat: row.cdr_response_code
        ? {
            fileName: row.sunat_file_name ?? '',
            responseCode: row.cdr_response_code,
            description: row.cdr_description ?? '',
            notes: row.cdr_notes,
          }
        : undefined,
    }));
  }
}
