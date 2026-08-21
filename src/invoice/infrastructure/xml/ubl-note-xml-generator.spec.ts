import { create } from 'xmlbuilder2';
import { fixtureNoteRequestBody } from '../../../../test/fixtures/note.fixture';
import { CreateNoteUseCase } from '../../application/use-cases/create-note.use-case';
import { InMemoryNoteRepository } from '../persistence/in-memory-note.repository';
import { NoteType } from '../../domain/value-objects/note-type.enum';
import { SpanishAmountInWordsConverter } from '../words/spanish-amount-in-words.converter';
import { UblNoteMapper } from './ubl-note-mapper';
import { UblNoteXmlGenerator } from './ubl-note-xml-generator';

const generator = new UblNoteXmlGenerator(
  new UblNoteMapper(new SpanishAmountInWordsConverter()),
);
const useCase = new CreateNoteUseCase(new InMemoryNoteRepository());

function xmlFor(type: NoteType, reasonCode: string): string {
  return generator.generate(
    useCase.buildAggregate(type, { ...fixtureNoteRequestBody, reasonCode }),
  );
}

describe('UblNoteXmlGenerator', () => {
  describe('credit note (07)', () => {
    const xml = xmlFor(NoteType.Credit, '01');

    it('is well formed with the CreditNote root namespace', () => {
      expect(xml).toContain(
        'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2',
      );
      expect(xml).toContain('<CreditNote ');
      expect(() => create(xml)).not.toThrow();
    });

    it.each([
      ['id', '<cbc:ID>F001-1</cbc:ID>'],
      ['discrepancy reference', '<cbc:ReferenceID>F001-1</cbc:ReferenceID>'],
      ['reason code', '<cbc:ResponseCode>01</cbc:ResponseCode>'],
      [
        'reason description',
        '<cbc:Description>Anulacion de la operacion</cbc:Description>',
      ],
      ['billing reference', '<cbc:DocumentTypeCode>01</cbc:DocumentTypeCode>'],
      ['credited quantity', '<cbc:CreditedQuantity unitCode="ZZ"'],
      ['credit line', '<cac:CreditNoteLine>'],
      ['monetary total', '<cac:LegalMonetaryTotal>'],
      [
        'total',
        '<cbc:PayableAmount currencyID="PEN">118.00</cbc:PayableAmount>',
      ],
      ['legend', 'CIENTO DIECIOCHO CON 00/100 SOLES'],
      ['signature placeholder', '<ext:ExtensionContent/>'],
    ])('contains %s', (_label, fragment) => {
      expect(xml).toContain(fragment);
    });
  });

  describe('debit note (08)', () => {
    const xml = xmlFor(NoteType.Debit, '02');

    it('uses DebitNote structures', () => {
      expect(xml).toContain(
        'urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2',
      );
      expect(xml).toContain('<cbc:DebitedQuantity unitCode="ZZ"');
      expect(xml).toContain('<cac:DebitNoteLine>');
      expect(xml).toContain('<cac:RequestedMonetaryTotal>');
      expect(xml).toContain('<cbc:ResponseCode>02</cbc:ResponseCode>');
    });
  });

  it('is deterministic', () => {
    expect(xmlFor(NoteType.Credit, '01')).toBe(xmlFor(NoteType.Credit, '01'));
  });
});
