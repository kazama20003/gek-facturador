import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixtureRequestBody } from '../../../../test/fixtures/invoice.fixture';
import type {
  SunatBillSender,
  SunatSendResult,
} from '../ports/sunat-bill-sender.port';
import type { UblXmlValidator } from '../ports/ubl-xml-validator.port';
import { InMemoryInvoiceRepository } from '../../infrastructure/persistence/in-memory-invoice.repository';
import { InMemorySubmissionRepository } from '../../infrastructure/persistence/submission.repositories';
import { XmldsigInvoiceSigner } from '../../infrastructure/signature/xmldsig-invoice-signer';
import { SpanishAmountInWordsConverter } from '../../infrastructure/words/spanish-amount-in-words.converter';
import { UblInvoiceMapper } from '../../infrastructure/xml/ubl-invoice-mapper';
import { UblInvoiceXmlGenerator } from '../../infrastructure/xml/ubl-invoice-xml-generator';
import { UblNoteMapper } from '../../infrastructure/xml/ubl-note-mapper';
import { UblNoteXmlGenerator } from '../../infrastructure/xml/ubl-note-xml-generator';
import { JszipInvoicePackager } from '../../infrastructure/zip/jszip-invoice-packager';
import { NoteType } from '../../domain/value-objects/note-type.enum';
import { CreateInvoiceUseCase } from './create-invoice.use-case';
import { CreateNoteUseCase } from './create-note.use-case';
import {
  InvalidSignedXmlError,
  SendInvoiceToSunatUseCase,
} from './send-invoice-to-sunat.use-case';

const certDir = join(process.cwd(), 'test', 'fixtures', 'certs');
const signer = new XmldsigInvoiceSigner({
  privateKeyPem: readFileSync(join(certDir, 'test-key.pem'), 'utf8'),
  certificatePem: readFileSync(join(certDir, 'test-cert.pem'), 'utf8'),
});
const okSender: SunatBillSender = {
  send: (): Promise<SunatSendResult> =>
    Promise.resolve({
      cdr: { responseCode: '0', description: 'ok', notes: [], accepted: true },
      cdrZipBase64: '',
    }),
  getStatusCdr: (): Promise<SunatSendResult> =>
    Promise.resolve({
      cdr: { responseCode: '0', description: 'ok', notes: [], accepted: true },
      cdrZipBase64: '',
    }),
};

describe('#4 XSD validation before sending', () => {
  it('throws when the signed XML is invalid, never reaching SUNAT', async () => {
    const invoice = new CreateInvoiceUseCase(
      new InMemoryInvoiceRepository(),
    ).buildAggregate(fixtureRequestBody);
    let sent = false;
    const sender: SunatBillSender = {
      send: () => {
        sent = true;
        return okSender.send('', Buffer.from(''));
      },
      getStatusCdr: () =>
        okSender.getStatusCdr({
          issuerRuc: '',
          documentType: '',
          series: '',
          correlative: 1,
        }),
    };
    const failingValidator: UblXmlValidator = {
      validate: () =>
        Promise.resolve({
          valid: false,
          errors: [{ message: 'missing node' }],
        }),
    };
    const uc = new SendInvoiceToSunatUseCase(
      new UblInvoiceXmlGenerator(
        new UblInvoiceMapper(new SpanishAmountInWordsConverter()),
      ),
      signer,
      new JszipInvoicePackager(),
      sender,
      failingValidator,
    );
    await expect(uc.execute(invoice)).rejects.toThrow(InvalidSignedXmlError);
    expect(sent).toBe(false);
  });
});

describe('#6 notes with affectations', () => {
  it('a credit note over an exonerated line carries EXO tax scheme and no IGV', () => {
    const note = new CreateNoteUseCase(
      // repo unused by buildAggregate
      {
        save: () => Promise.resolve(),
        findById: () => Promise.resolve(null),
        existsSeriesCorrelative: () => Promise.resolve(false),
        recordSunatOutcome: () => Promise.resolve(),
      },
    ).buildAggregate(NoteType.Credit, {
      series: 'F001',
      correlative: 1,
      issueDate: '2026-08-20',
      currency: 'PEN',
      reasonCode: '01',
      modifies: { series: 'F001', correlative: 1 },
      issuer: {
        ruc: '20000000001',
        businessName: 'EMITEC SAC',
        address: {
          ubigeo: '150101',
          department: 'LIMA',
          province: 'LIMA',
          district: 'LIMA',
          addressLine: 'AV. X',
        },
      },
      customer: { ruc: '20100070970', businessName: 'CLIENTE SAC' },
      items: [
        {
          description: 'Exonerado',
          unitCode: 'ZZ',
          quantity: '1',
          unitValue: '50.00',
          igvAffectationCode: '20',
        },
      ],
    });
    const xml = new UblNoteXmlGenerator(
      new UblNoteMapper(new SpanishAmountInWordsConverter()),
    ).generate(note);
    expect(xml).toContain('>20</cbc:TaxExemptionReasonCode>');
    expect(xml).toContain('>9997</cbc:ID>');
    expect(xml).toContain(
      '<cbc:TaxAmount currencyID="PEN">0.00</cbc:TaxAmount>',
    );
    expect(note.igv.toFixed()).toBe('0.00');
  });
});

describe('#7 submission lookup', () => {
  it('finds the latest RC/RA submission by document id', async () => {
    const repo = new InMemorySubmissionRepository();
    await repo.record({
      kind: 'RC',
      documentId: 'RC-20260820-1',
      fileName: 'f.zip',
      ticket: 'T-1',
      statusCode: '0',
      signedXml: '<x/>',
    });
    const found = await repo.findByDocumentId('RC-20260820-1');
    expect(found?.ticket).toBe('T-1');
    expect(await repo.findByDocumentId('RA-9')).toBeNull();
  });
});
