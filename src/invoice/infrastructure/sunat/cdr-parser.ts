import JSZip from 'jszip';
import type { CdrResult } from '../../application/ports/sunat-bill-sender.port';

/**
 * Tolerant, read-only extraction over the CDR ApplicationResponse.
 *
 * Deliberately NOT a strict XML parse: SUNAT's real CDRs are not
 * namespace-clean (undeclared/reset prefixes) and strict DOM parsers
 * (xmlbuilder2) reject them. The CDR is machine-generated with a stable
 * shape, and we only read three well-known leaf elements, so scoped
 * pattern extraction is the pragmatic choice.
 */
function textBetween(source: string, localName: string): string | undefined {
  const match = source.match(
    new RegExp(
      `<(?:[\\w.-]+:)?${localName}[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${localName}>`,
    ),
  );
  return match?.[1].trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Parses the CDR ApplicationResponse XML (already extracted from the ZIP). */
export function parseCdrXml(cdrXml: string): CdrResult {
  // Scope to DocumentResponse so we don't pick codes from unrelated sections.
  const documentResponse = textBetween(cdrXml, 'DocumentResponse') ?? cdrXml;

  const responseCode = textBetween(documentResponse, 'ResponseCode') ?? '';
  const description = decodeEntities(
    textBetween(documentResponse, 'Description') ?? '',
  );

  const notes = [
    ...cdrXml.matchAll(
      /<(?:[\w.-]+:)?Note[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?Note>/g,
    ),
  ]
    .map((m) => decodeEntities(m[1].trim()))
    .filter((n) => n.length > 0);

  return {
    responseCode,
    description,
    notes,
    accepted: responseCode === '0',
  };
}

/** Extracts the R-*.xml ApplicationResponse from SUNAT's CDR ZIP. */
export async function extractCdrXmlFromZip(zip: Buffer): Promise<string> {
  const archive = await JSZip.loadAsync(zip);
  const entry = Object.values(archive.files).find(
    (f) => !f.dir && /(^|\/)R-.*\.xml$/i.test(f.name),
  );
  if (!entry) {
    throw new Error('SUNAT response ZIP does not contain a CDR (R-*.xml).');
  }
  return entry.async('string');
}
