import JSZip from 'jszip';
import { JszipInvoicePackager } from './jszip-invoice-packager';

describe('JszipInvoicePackager', () => {
  const packager = new JszipInvoicePackager();
  const xml = '<?xml version="1.0" encoding="UTF-8"?><Invoice/>';

  it('creates a ZIP with the XML under the SUNAT naming convention', async () => {
    const zip = await packager.package('20000000001-01-F001-1', xml);
    const archive = await JSZip.loadAsync(zip);

    const entry = archive.file('20000000001-01-F001-1.xml');
    expect(entry).not.toBeNull();
    await expect(entry!.async('string')).resolves.toBe(xml);
  });

  it('is byte-deterministic for the same input', async () => {
    const a = await packager.package('20000000001-01-F001-1', xml);
    const b = await packager.package('20000000001-01-F001-1', xml);
    expect(a.equals(b)).toBe(true);
  });
});
