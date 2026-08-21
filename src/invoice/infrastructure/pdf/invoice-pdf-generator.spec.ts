import { fixtureInvoice } from '../../../../test/fixtures/invoice.fixture';
import { SpanishAmountInWordsConverter } from '../words/spanish-amount-in-words.converter';
import { ReactInvoicePdfGenerator } from './invoice-pdf-generator';

const SIGNED_XML =
  '<Invoice><ext:UBLExtensions><ds:Signature>' +
  '<ds:DigestValue>abc123DIGEST==</ds:DigestValue>' +
  '</ds:Signature></ext:UBLExtensions></Invoice>';

describe('ReactInvoicePdfGenerator', () => {
  const generator = new ReactInvoicePdfGenerator(
    new SpanishAmountInWordsConverter(),
  );

  it('renders a PDF buffer for the printed representation', async () => {
    const buffer = await generator.generate(fixtureInvoice(), SIGNED_XML);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    // Every PDF starts with the "%PDF" magic bytes.
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
    // A real page with the embedded QR image is far from empty.
    expect(buffer.length).toBeGreaterThan(2000);
  });

  it('embeds an image XObject (the QR code) in the document', async () => {
    const buffer = await generator.generate(fixtureInvoice(), SIGNED_XML);
    const content = buffer.toString('latin1');

    // react-pdf writes embedded raster images as image XObjects.
    expect(content).toContain('/Subtype /Image');
  });
});
