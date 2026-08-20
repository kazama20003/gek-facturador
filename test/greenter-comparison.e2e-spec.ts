import { fixtureInvoice } from './fixtures/invoice.fixture';
import { SpanishAmountInWordsConverter } from '../src/invoice/infrastructure/words/spanish-amount-in-words.converter';
import { UblInvoiceMapper } from '../src/invoice/infrastructure/xml/ubl-invoice-mapper';
import { UblInvoiceXmlGenerator } from '../src/invoice/infrastructure/xml/ubl-invoice-xml-generator';

/**
 * Structural comparison against Greenter's invoice output
 * (https://github.com/thegreenter/xml, MIT license — used as a reference
 * implementation for verification; nothing is copied from it).
 *
 * The invariants below were taken from the XML produced by greenter/xml's
 * InvoiceTemplate (twig templates, v21 UBL 2.1) for an equivalent basic
 * taxed invoice. SUNAT specifications remain the source of truth.
 *
 * Known, intentional differences with Greenter:
 * - Greenter emits `<cbc:ProfileID>` (operation type, UBL 2.0 style) in some
 *   templates; in UBL 2.1 the operation type travels as `@listID` of
 *   `cbc:InvoiceTypeCode`, which is what Emitec emits.
 * - Greenter includes optional sections we don't support yet (due date,
 *   payment terms, despatch references).
 * - Attribute sets on code lists are equivalent but not byte-identical;
 *   both are optional metadata per UBL XSD.
 */
describe('Greenter structural comparison', () => {
  const xml = new UblInvoiceXmlGenerator(
    new UblInvoiceMapper(new SpanishAmountInWordsConverter()),
  ).generate(fixtureInvoice());

  it('uses the same namespaces as Greenter invoices', () => {
    for (const uri of [
      'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
      'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
      'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
      'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
      'http://www.w3.org/2000/09/xmldsig#',
    ]) {
      expect(xml).toContain(uri);
    }
  });

  it('keeps the same section order as Greenter', () => {
    const order = [
      '<ext:UBLExtensions>',
      '<cbc:UBLVersionID>',
      '<cbc:CustomizationID>',
      '<cbc:ID>',
      '<cbc:IssueDate>',
      '<cbc:InvoiceTypeCode',
      '<cbc:Note',
      '<cbc:DocumentCurrencyCode',
      '<cac:Signature>',
      '<cac:AccountingSupplierParty>',
      '<cac:AccountingCustomerParty>',
      '<cac:TaxTotal>',
      '<cac:LegalMonetaryTotal>',
      '<cac:InvoiceLine>',
    ];
    const positions = order.map((tag) => xml.indexOf(tag));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it.each([
    ['UBL version 2.1', '<cbc:UBLVersionID>2.1</cbc:UBLVersionID>'],
    ['customization 2.0', '<cbc:CustomizationID>2.0</cbc:CustomizationID>'],
    ['document id serie-correlativo', '<cbc:ID>F001-1</cbc:ID>'],
    ['document type 01', '>01</cbc:InvoiceTypeCode>'],
    ['IGV tax id 1000', '>1000</cbc:ID>'],
    ['tax name IGV', '<cbc:Name>IGV</cbc:Name>'],
    ['international code VAT', '<cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>'],
    ['affectation 10', '>10</cbc:TaxExemptionReasonCode>'],
    ['price type 01', '>01</cbc:PriceTypeCode>'],
    ['legend code 1000', 'languageLocaleID="1000"'],
    ['currency on amounts', 'currencyID="PEN"'],
    [
      'sale value',
      '<cbc:LineExtensionAmount currencyID="PEN">100.00</cbc:LineExtensionAmount>',
    ],
    ['total', '<cbc:PayableAmount currencyID="PEN">118.00</cbc:PayableAmount>'],
    ['signature placeholder extension', '<ext:ExtensionContent/>'],
    ['declarative signature reference', '<cac:DigitalSignatureAttachment>'],
  ])('matches Greenter on %s', (_label, fragment) => {
    expect(xml).toContain(fragment);
  });
});
