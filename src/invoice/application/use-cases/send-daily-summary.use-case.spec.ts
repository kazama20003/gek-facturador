import { fixtureRequestBody } from '../../../../test/fixtures/invoice.fixture';
import { InvoiceNotFoundError } from '../../domain/errors/invoice-errors';
import type {
  SunatSummarySender,
  SunatSummaryStatus,
} from '../ports/sunat-summary-sender.port';
import { InMemoryInvoiceRepository } from '../../infrastructure/persistence/in-memory-invoice.repository';
import { UblSummaryXmlGenerator } from '../../infrastructure/xml/ubl-summary-xml-generator';
import { CreateInvoiceUseCase } from './create-invoice.use-case';
import { SendDailySummaryUseCase } from './send-daily-summary.use-case';

const boletaBody = {
  ...fixtureRequestBody,
  documentType: '03' as const,
  series: 'B001',
  customer: { dni: '12345678', businessName: 'JUAN PEREZ' },
};

function fakeSender(
  statuses: SunatSummaryStatus[],
): SunatSummarySender & { calls: number } {
  const sender = {
    calls: 0,
    sendSummary: () => Promise.resolve({ ticket: 'T-1' }),
    getStatus: () => {
      const status = statuses[Math.min(sender.calls, statuses.length - 1)];
      sender.calls += 1;
      return Promise.resolve(status);
    },
  };
  return sender;
}

const acceptedCdr = {
  responseCode: '0',
  description: 'El Resumen diario RC-20260820-1, ha sido aceptado',
  notes: [],
  accepted: true,
};

async function repoWithBoletas(): Promise<InMemoryInvoiceRepository> {
  const repo = new InMemoryInvoiceRepository();
  const create = new CreateInvoiceUseCase(repo);
  await create.execute({ ...boletaBody, correlative: 1 });
  await create.execute({ ...boletaBody, correlative: 2 });
  return repo;
}

function useCase(repo: InMemoryInvoiceRepository, sender: SunatSummarySender) {
  return new SendDailySummaryUseCase(
    repo,
    new UblSummaryXmlGenerator(),
    { sign: (xml) => xml },
    { package: () => Promise.resolve(Buffer.from('zip')) },
    sender,
    () => Promise.resolve(), // no real delays in tests
  );
}

describe('SendDailySummaryUseCase', () => {
  it('summarizes the day boletas, resolves the ticket and marks them ACCEPTED', async () => {
    const repo = await repoWithBoletas();
    const sender = fakeSender([
      { statusCode: '98' },
      { statusCode: '0', cdr: acceptedCdr, cdrZipBase64: 'UEs=' },
    ]);

    const result = await useCase(repo, sender).execute({
      issuerRuc: '20000000001',
      referenceDate: '2026-08-20',
      summaryCorrelative: 1,
    });

    expect(result.summaryId).toBe('RC-20260820-1');
    expect(result.fileName).toBe('20000000001-RC-20260820-1.zip');
    expect(result.boletas).toEqual(['B001-1', 'B001-2']);
    expect(result.statusCode).toBe('0');
    expect(result.cdr?.accepted).toBe(true);
    expect(sender.calls).toBe(2); // polled through the 98 in-progress state

    const stored = await repo.findBoletasByIssueDate(
      '20000000001',
      '2026-08-20',
    );
    expect(stored.map((s) => s.status)).toEqual(['ACCEPTED', 'ACCEPTED']);
  });

  it('fails clearly when there are no boletas for the date', async () => {
    const repo = new InMemoryInvoiceRepository();
    await expect(
      useCase(repo, fakeSender([{ statusCode: '0' }])).execute({
        issuerRuc: '20000000001',
        referenceDate: '2026-08-20',
        summaryCorrelative: 1,
      }),
    ).rejects.toThrow(InvoiceNotFoundError);
  });

  it('marks boletas REJECTED when SUNAT processes with errors (99)', async () => {
    const repo = await repoWithBoletas();
    const sender = fakeSender([
      {
        statusCode: '99',
        cdr: {
          responseCode: '2334',
          description: 'rechazado',
          notes: [],
          accepted: false,
        },
        cdrZipBase64: 'UEs=',
      },
    ]);

    const result = await useCase(repo, sender).execute({
      issuerRuc: '20000000001',
      referenceDate: '2026-08-20',
      summaryCorrelative: 1,
    });

    expect(result.statusCode).toBe('99');
    const stored = await repo.findBoletasByIssueDate(
      '20000000001',
      '2026-08-20',
    );
    expect(stored.map((s) => s.status)).toEqual(['REJECTED', 'REJECTED']);
  });
});

describe('UblSummaryXmlGenerator', () => {
  it('renders the RC structure per SUNAT SummaryDocuments schema', async () => {
    const repo = await repoWithBoletas();
    const stored = await repo.findBoletasByIssueDate(
      '20000000001',
      '2026-08-20',
    );
    const xml = new UblSummaryXmlGenerator().generate({
      referenceDate: '2026-08-20',
      issueDate: '2026-08-21',
      correlative: 1,
      boletas: stored.map((s) => s.invoice),
    });

    expect(xml).toContain(
      'urn:sunat:names:specification:ubl:peru:schema:xsd:SummaryDocuments-1',
    );
    expect(xml).toContain('<cbc:UBLVersionID>2.0</cbc:UBLVersionID>');
    expect(xml).toContain('<cbc:CustomizationID>1.1</cbc:CustomizationID>');
    expect(xml).toContain('<cbc:ID>RC-20260820-1</cbc:ID>');
    expect(xml).toContain('<cbc:ReferenceDate>2026-08-20</cbc:ReferenceDate>');
    expect(xml).toContain('<sac:SummaryDocumentsLine>');
    // customer goes in the cac namespace — SUNAT's XSD rejects sac here
    expect(xml).toContain('<cac:AccountingCustomerParty>');
    expect(xml).toContain('<cbc:ConditionCode>1</cbc:ConditionCode>');
    expect(xml).toContain(
      '<sac:TotalAmount currencyID="PEN">118.00</sac:TotalAmount>',
    );
    expect(xml.match(/<sac:SummaryDocumentsLine>/g)).toHaveLength(2);
    expect(xml).toContain('<cbc:ID>B001-2</cbc:ID>');
  });
});
