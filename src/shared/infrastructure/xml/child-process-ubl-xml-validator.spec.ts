import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ChildProcessUblXmlValidator } from './child-process-ubl-xml-validator';

jest.setTimeout(60_000);

const validator = new ChildProcessUblXmlValidator();

function goldenXml(): string {
  return readFileSync(
    join(process.cwd(), 'test', 'fixtures', 'invoice-f001-1.golden.xml'),
    'utf8',
  );
}

/** Unsigned golden without the extension placeholder — fully XSD-valid. */
function signedEquivalentXml(): string {
  return goldenXml().replace(
    /\s*<ext:UBLExtensions>[\s\S]*?<\/ext:UBLExtensions>/,
    '',
  );
}

describe('ChildProcessUblXmlValidator (UBL 2.1 XSD)', () => {
  it('accepts a structurally valid invoice', async () => {
    const result = await validator.validate(signedEquivalentXml());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports the empty ExtensionContent as the only deviation of the unsigned XML', async () => {
    const result = await validator.validate(goldenXml());
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('ExtensionContent');
  });

  it('rejects malformed XML with a readable error', async () => {
    const result = await validator.validate('<Invoice><unclosed></Invoice>');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(typeof result.errors[0].message).toBe('string');
  });

  it('detects a missing mandatory node', async () => {
    const withoutId = signedEquivalentXml().replace(
      '<cbc:ID>F001-1</cbc:ID>',
      '',
    );
    const result = await validator.validate(withoutId);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('ID'))).toBe(true);
  });

  it('detects a type-invalid value', async () => {
    const badQuantity = signedEquivalentXml().replace(
      /(<cbc:InvoicedQuantity[^>]*>)1(<\/cbc:InvoicedQuantity>)/,
      '$1NOT_A_NUMBER$2',
    );
    const result = await validator.validate(badQuantity);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.message.includes('InvoicedQuantity')),
    ).toBe(true);
  });

  it('returns line information for errors', async () => {
    const result = await validator.validate(goldenXml());
    expect(result.errors[0].line).toBeGreaterThan(0);
  });
});
