import { fixtureRequestBody } from '../../../../test/fixtures/invoice.fixture';
import { InvoiceNotFoundError } from '../../domain/errors/invoice-errors';
import type { SunatSummarySender } from '../ports/sunat-summary-sender.port';
import { InMemoryInvoiceRepository } from '../../infrastructure/persistence/in-memory-invoice.repository';
import { UblVoidedXmlGenerator } from '../../infrastructure/xml/ubl-voided-xml-generator';
import { CreateInvoiceUseCase } from './create-invoice.use-case';
import {
  InvoiceNotVoidableError,
  VoidInvoicesUseCase,
} from './void-invoices.use-case';

const acceptedCdr = {
  responseCode: '0',
  description: 'La Comunicacion de baja RA-20260820-1, ha sido aceptada',
  notes: [],
  accepted: true,
};

const sender: SunatSummarySender = {
  sendSummary: () => Promise.resolve({ ticket: 'T-1' }),
  getStatus: () =>
    Promise.resolve({
      statusCode: '0',
      cdr: acceptedCdr,
      cdrZipBase64: 'UEs=',
    }),
};

function useCase(repo: InMemoryInvoiceRepository) {
  return new VoidInvoicesUseCase(
    repo,
    new UblVoidedXmlGenerator(),
    { sign: (xml) => xml },
    { package: () => Promise.resolve(Buffer.from('zip')) },
    sender,
    () => '2026-08-21',
    () => Promise.resolve(),
  );
}

async function acceptedInvoice(
  repo: InMemoryInvoiceRepository,
): Promise<string> {
  const created = await new CreateInvoiceUseCase(repo).execute(
    fixtureRequestBody,
  );
  await repo.recordSunatOutcome(created.id, {
    fileName: 'f.zip',
    cdr: { responseCode: '0', description: 'ok', notes: [], accepted: true },
    cdrZipBase64: '',
    signedXml: '',
  });
  return created.id;
}

describe('VoidInvoicesUseCase', () => {
  it('voids an ACCEPTED invoice and marks it VOIDED', async () => {
    const repo = new InMemoryInvoiceRepository();
    const id = await acceptedInvoice(repo);

    const result = await useCase(repo).execute({
      voidCorrelative: 1,
      documents: [{ invoiceId: id, reason: 'Error en la operacion' }],
    });

    expect(result.voidedId).toBe('RA-20260820-1');
    expect(result.fileName).toBe('20000000001-RA-20260820-1.zip');
    expect(result.documents).toEqual(['F001-1']);
    expect(result.cdr?.accepted).toBe(true);
    expect((await repo.findById(id))?.status).toBe('VOIDED');
  });

  it('rejects voiding documents that are not ACCEPTED', async () => {
    const repo = new InMemoryInvoiceRepository();
    const created = await new CreateInvoiceUseCase(repo).execute(
      fixtureRequestBody,
    );

    await expect(
      useCase(repo).execute({
        voidCorrelative: 1,
        documents: [{ invoiceId: created.id, reason: 'x' }],
      }),
    ).rejects.toThrow(InvoiceNotVoidableError);
  });

  it('rejects boletas — they are voided through the daily summary', async () => {
    const repo = new InMemoryInvoiceRepository();
    const boleta = await new CreateInvoiceUseCase(repo).execute({
      ...fixtureRequestBody,
      documentType: '03',
      series: 'B001',
      customer: { dni: '12345678', businessName: 'JUAN PEREZ' },
    });
    await repo.recordSunatOutcome(boleta.id, {
      fileName: 'b.zip',
      cdr: { responseCode: '0', description: 'ok', notes: [], accepted: true },
      cdrZipBase64: '',
      signedXml: '',
    });

    await expect(
      useCase(repo).execute({
        voidCorrelative: 1,
        documents: [{ invoiceId: boleta.id, reason: 'x' }],
      }),
    ).rejects.toThrow(InvoiceNotVoidableError);
  });

  it('fails with 404-style error for unknown ids', async () => {
    const repo = new InMemoryInvoiceRepository();
    await expect(
      useCase(repo).execute({
        voidCorrelative: 1,
        documents: [{ invoiceId: 'nope', reason: 'x' }],
      }),
    ).rejects.toThrow(InvoiceNotFoundError);
  });
});

describe('UblVoidedXmlGenerator', () => {
  it('renders the RA structure per SUNAT VoidedDocuments schema', () => {
    const xml = new UblVoidedXmlGenerator().generate({
      issuer: { ruc: '20000000001', businessName: 'EMITEC SAC' },
      referenceDate: '2026-08-20',
      issueDate: '2026-08-21',
      correlative: 1,
      lines: [
        {
          documentType: '01',
          series: 'F001',
          correlative: 2,
          reason: 'Error en la operacion',
        },
      ],
    });

    expect(xml).toContain(
      'urn:sunat:names:specification:ubl:peru:schema:xsd:VoidedDocuments-1',
    );
    expect(xml).toContain('<cbc:UBLVersionID>2.0</cbc:UBLVersionID>');
    expect(xml).toContain('<cbc:CustomizationID>1.0</cbc:CustomizationID>');
    expect(xml).toContain('<cbc:ID>RA-20260820-1</cbc:ID>');
    expect(xml).toContain('<sac:VoidedDocumentsLine>');
    expect(xml).toContain('<sac:DocumentSerialID>F001</sac:DocumentSerialID>');
    expect(xml).toContain('<sac:DocumentNumberID>2</sac:DocumentNumberID>');
    expect(xml).toContain(
      '<sac:VoidReasonDescription>Error en la operacion</sac:VoidReasonDescription>',
    );
  });
});
