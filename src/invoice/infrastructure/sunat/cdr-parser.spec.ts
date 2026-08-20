import JSZip from 'jszip';
import { extractCdrXmlFromZip, parseCdrXml } from './cdr-parser';

function cdrXml(
  responseCode: string,
  description: string,
  notes: string[] = [],
): string {
  const noteElements = notes.map((n) => `<cbc:Note>${n}</cbc:Note>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<ar:ApplicationResponse xmlns:ar="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>R-20000000001-01-F001-1</cbc:ID>
  ${noteElements}
  <cac:DocumentResponse>
    <cac:Response>
      <cbc:ReferenceID>20000000001-01-F001-1</cbc:ReferenceID>
      <cbc:ResponseCode>${responseCode}</cbc:ResponseCode>
      <cbc:Description>${description}</cbc:Description>
    </cac:Response>
  </cac:DocumentResponse>
</ar:ApplicationResponse>`;
}

describe('parseCdrXml', () => {
  it('parses an accepted CDR (code 0)', () => {
    const cdr = parseCdrXml(
      cdrXml('0', 'La Factura numero F001-1, ha sido aceptada'),
    );
    expect(cdr.accepted).toBe(true);
    expect(cdr.responseCode).toBe('0');
    expect(cdr.description).toContain('aceptada');
    expect(cdr.notes).toEqual([]);
  });

  it('parses a rejection (code >= 2000)', () => {
    const cdr = parseCdrXml(
      cdrXml('2335', 'El documento electronico ya existe'),
    );
    expect(cdr.accepted).toBe(false);
    expect(cdr.responseCode).toBe('2335');
  });

  it('parses observation notes', () => {
    const cdr = parseCdrXml(
      cdrXml('0', 'Aceptada con observaciones', ['4252 - Observacion X']),
    );
    expect(cdr.accepted).toBe(true);
    expect(cdr.notes).toEqual(['4252 - Observacion X']);
  });
});

describe('extractCdrXmlFromZip', () => {
  it('extracts the R-*.xml from the response ZIP', async () => {
    const zip = new JSZip();
    const xml = cdrXml('0', 'ok');
    zip.file('R-20000000001-01-F001-1.xml', xml);
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    await expect(extractCdrXmlFromZip(buffer)).resolves.toBe(xml);
  });

  it('finds the CDR even inside a folder (dummy/)', async () => {
    const zip = new JSZip();
    zip.file('dummy/R-20000000001-01-F001-1.xml', cdrXml('0', 'ok'));
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    await expect(extractCdrXmlFromZip(buffer)).resolves.toContain(
      'ApplicationResponse',
    );
  });

  it('fails clearly when there is no CDR in the ZIP', async () => {
    const zip = new JSZip();
    zip.file('otro.txt', 'nada');
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    await expect(extractCdrXmlFromZip(buffer)).rejects.toThrow(
      'does not contain a CDR',
    );
  });
});
