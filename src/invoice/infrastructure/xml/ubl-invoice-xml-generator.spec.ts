import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { create } from 'xmlbuilder2';
import { fixtureInvoice } from '../../../../test/fixtures/invoice.fixture';
import { Invoice } from '../../domain/aggregates/invoice';
import { InvalidPartyError } from '../../domain/errors/invoice-errors';
import { Address } from '../../domain/value-objects/address';
import { Correlative } from '../../domain/value-objects/correlative';
import { Currency } from '../../domain/value-objects/currency';
import { InvoiceSeries } from '../../domain/value-objects/invoice-series';
import { Money } from '../../domain/value-objects/money';
import { Party } from '../../domain/value-objects/party';
import { Quantity } from '../../domain/value-objects/quantity';
import { Ruc } from '../../domain/value-objects/ruc';
import { SpanishAmountInWordsConverter } from '../words/spanish-amount-in-words.converter';
import { UblInvoiceMapper } from './ubl-invoice-mapper';
import { UblInvoiceXmlGenerator } from './ubl-invoice-xml-generator';
import { UBL_NAMESPACES } from './ubl-namespaces';

const generator = new UblInvoiceXmlGenerator(
  new UblInvoiceMapper(new SpanishAmountInWordsConverter()),
);

function baseInvoice(): Invoice {
  return Invoice.create({
    id: 'test',
    series: InvoiceSeries.create('F001'),
    correlative: Correlative.create(1),
    issueDate: new Date('2026-08-20T00:00:00.000Z'),
    currency: Currency.PEN,
    issuer: Party.create({
      ruc: Ruc.create('20000000001'),
      businessName: 'EMITEC SAC',
      address: Address.create({
        ubigeo: '150101',
        department: 'LIMA',
        province: 'LIMA',
        district: 'LIMA',
        addressLine: 'AV. EJEMPLO 123',
      }),
    }),
    customer: Party.create({
      ruc: Ruc.create('20100070970'),
      businessName: 'CLIENTE SAC',
    }),
  });
}

describe('UblInvoiceXmlGenerator', () => {
  describe('basic invoice F001-1', () => {
    const xml = generator.generate(fixtureInvoice());

    it('is well formed with UTF-8 declaration', () => {
      expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(
        true,
      );
      expect(() => create(xml)).not.toThrow();
    });

    it('declares all required namespaces', () => {
      for (const uri of Object.values(UBL_NAMESPACES)) {
        expect(xml).toContain(uri);
      }
    });

    it.each([
      ['document id', '<cbc:ID>F001-1</cbc:ID>'],
      ['issue date', '<cbc:IssueDate>2026-08-20</cbc:IssueDate>'],
      ['document type 01', '>01</cbc:InvoiceTypeCode>'],
      ['operation type 0101', 'listID="0101"'],
      ['currency PEN', '>PEN</cbc:DocumentCurrencyCode>'],
      ['issuer RUC', '>20000000001</cbc:ID>'],
      ['customer RUC', '>20100070970</cbc:ID>'],
      [
        'taxable amount',
        '<cbc:TaxableAmount currencyID="PEN">100.00</cbc:TaxableAmount>',
      ],
      ['IGV amount', '<cbc:TaxAmount currencyID="PEN">18.00</cbc:TaxAmount>'],
      [
        'payable amount',
        '<cbc:PayableAmount currencyID="PEN">118.00</cbc:PayableAmount>',
      ],
      ['IGV affectation 10', '>10</cbc:TaxExemptionReasonCode>'],
      ['tax code 1000', '>1000</cbc:ID>'],
      ['unit code ZZ', 'unitCode="ZZ"'],
      ['amount legend', 'CIENTO DIECIOCHO CON 00/100 SOLES'],
      ['legend code', 'languageLocaleID="1000"'],
      ['signature reference', '<cbc:URI>#IDSignSP</cbc:URI>'],
      ['empty extension for future signature', '<ext:ExtensionContent/>'],
      ['identity document type 6', 'schemeID="6"'],
      ['ubigeo', '>150101</cbc:ID>'],
    ])('contains %s', (_label, fragment) => {
      expect(xml).toContain(fragment);
    });
  });

  describe('several items', () => {
    function multiItemInvoice(): Invoice {
      const invoice = baseInvoice();
      invoice.addTaxableItem({
        description: 'Servicio A',
        unitCode: 'ZZ',
        quantity: Quantity.create('1'),
        unitValue: Money.pen('100.00'),
      });
      invoice.addTaxableItem({
        description: 'Servicio B',
        unitCode: 'ZZ',
        quantity: Quantity.create('2'),
        unitValue: Money.pen('50.00'),
      });
      invoice.issue();
      return invoice;
    }

    it('numbers lines consecutively and sums totals', () => {
      const xml = generator.generate(multiItemInvoice());
      const lineIds = [
        ...xml.matchAll(/<cbc:ID>(\d+)<\/cbc:ID>\s*<cbc:InvoicedQuantity/g),
      ].map((m) => m[1]);
      expect(lineIds).toEqual(['1', '2']);
      expect(xml).toContain(
        '<cbc:TaxableAmount currencyID="PEN">200.00</cbc:TaxableAmount>',
      );
      expect(xml).toContain(
        '<cbc:TaxAmount currencyID="PEN">36.00</cbc:TaxAmount>',
      );
      expect(xml).toContain(
        '<cbc:PayableAmount currencyID="PEN">236.00</cbc:PayableAmount>',
      );
    });

    it('is deterministic: same aggregate, identical XML', () => {
      expect(generator.generate(multiItemInvoice())).toBe(
        generator.generate(multiItemInvoice()),
      );
    });
  });

  describe('special characters', () => {
    it('escapes markup and preserves UTF-8 text', () => {
      const invoice = baseInvoice();
      invoice.addTaxableItem({
        description: 'Ñandú & cía <transporte> "según" pedido nº 5 — áéíóú',
        unitCode: 'ZZ',
        quantity: Quantity.create('1'),
        unitValue: Money.pen('100.00'),
      });
      invoice.issue();
      const xml = generator.generate(invoice);

      expect(xml).toContain('Ñandú &amp; cía &lt;transporte&gt;');
      expect(xml).toContain('áéíóú');
      // no raw markup characters leak into text content and the XML still parses
      expect(xml).not.toContain('cía <transporte>');
      expect(() => create(xml)).not.toThrow();
    });
  });

  describe('golden file', () => {
    it('matches the stored golden XML for the fixture invoice', () => {
      const golden = readFileSync(
        join(process.cwd(), 'test', 'fixtures', 'invoice-f001-1.golden.xml'),
        'utf8',
      );
      const normalize = (s: string) => s.replace(/\r\n/g, '\n').trimEnd();
      expect(normalize(generator.generate(fixtureInvoice()))).toBe(
        normalize(golden),
      );
    });
  });

  describe('issuer address requirement', () => {
    it('refuses to generate XML when the issuer has no fiscal address', () => {
      const invoice = Invoice.create({
        id: 'test',
        series: InvoiceSeries.create('F001'),
        correlative: Correlative.create(1),
        issueDate: new Date('2026-08-20T00:00:00.000Z'),
        currency: Currency.PEN,
        issuer: Party.create({
          ruc: Ruc.create('20000000001'),
          businessName: 'EMITEC SAC',
        }),
        customer: Party.create({
          ruc: Ruc.create('20100070970'),
          businessName: 'CLIENTE SAC',
        }),
      });
      invoice.addTaxableItem({
        description: 'Servicio',
        unitCode: 'ZZ',
        quantity: Quantity.create('1'),
        unitValue: Money.pen('100.00'),
      });
      invoice.issue();
      expect(() => generator.generate(invoice)).toThrow(InvalidPartyError);
    });
  });
});
