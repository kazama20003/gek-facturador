import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixtureNoteRequestBody } from '../../../../test/fixtures/note.fixture';
import { CreateNoteUseCase } from '../../application/use-cases/create-note.use-case';
import { NoteType } from '../../domain/value-objects/note-type.enum';
import { XmldsigInvoiceSigner } from '../signature/xmldsig-invoice-signer';
import { SpanishAmountInWordsConverter } from '../words/spanish-amount-in-words.converter';
import { ChildProcessUblXmlValidator } from '../../../shared/infrastructure/xml/child-process-ubl-xml-validator';
import { UblNoteMapper } from './ubl-note-mapper';
import { UblNoteXmlGenerator } from './ubl-note-xml-generator';

jest.setTimeout(60_000);

const generator = new UblNoteXmlGenerator(
  new UblNoteMapper(new SpanishAmountInWordsConverter()),
);
const certDir = join(process.cwd(), 'test', 'fixtures', 'certs');
const signer = new XmldsigInvoiceSigner({
  privateKeyPem: readFileSync(join(certDir, 'test-key.pem'), 'utf8'),
  certificatePem: readFileSync(join(certDir, 'test-cert.pem'), 'utf8'),
});
const validator = new ChildProcessUblXmlValidator();
const useCase = new CreateNoteUseCase();

describe('Signed notes vs official UBL 2.1 XSDs', () => {
  it('a signed credit note is 100% XSD-valid', async () => {
    const note = useCase.buildAggregate(
      NoteType.Credit,
      fixtureNoteRequestBody,
    );
    const result = await validator.validate(
      signer.sign(generator.generate(note)),
    );
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('a signed debit note is 100% XSD-valid', async () => {
    const note = useCase.buildAggregate(NoteType.Debit, {
      ...fixtureNoteRequestBody,
      reasonCode: '02',
    });
    const result = await validator.validate(
      signer.sign(generator.generate(note)),
    );
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});
