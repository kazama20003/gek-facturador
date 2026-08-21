import { fixtureInvoice } from '../../../../test/fixtures/invoice.fixture';
import { buildSunatQrContent, extractSignatureDigest } from './sunat-qr';

describe('SUNAT QR', () => {
  it('extracts the DigestValue from a signed XML', () => {
    const xml = '<a><ds:DigestValue>ABC123==</ds:DigestValue></a>';
    expect(extractSignatureDigest(xml)).toBe('ABC123==');
    expect(extractSignatureDigest('<a/>')).toBe('');
  });

  it('builds the pipe-separated QR content per SUNAT guide', () => {
    const qr = buildSunatQrContent(fixtureInvoice(), 'HASH==');
    expect(qr).toBe(
      '20000000001|01|F001|1|18.00|118.00|2026-08-20|6|20100070970|HASH==',
    );
  });
});
