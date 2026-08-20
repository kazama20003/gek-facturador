import JSZip from 'jszip';
import type { InvoicePackager } from '../../application/ports/invoice-packager.port';

/** Fixed timestamp so the ZIP is byte-deterministic for the same XML. */
const FIXED_DATE = new Date('2000-01-01T00:00:00.000Z');

/** Builds RUC-01-SERIE-CORRELATIVO.zip with the signed XML at its root. */
export class JszipInvoicePackager implements InvoicePackager {
  async package(baseFileName: string, signedXml: string): Promise<Buffer> {
    const zip = new JSZip();
    zip.file(`${baseFileName}.xml`, signedXml, { date: FIXED_DATE });
    return zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });
  }
}
