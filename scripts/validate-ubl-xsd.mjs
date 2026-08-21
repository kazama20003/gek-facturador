/**
 * XSD validation worker. Reads XML from stdin, writes a JSON
 * { valid, errors: [{ message, line, column }] } result to stdout.
 *
 * Runs in a separate process because libxml2-wasm is ESM-only (incompatible
 * with the project's CommonJS/Jest setup) and process isolation also contains
 * the XML parser. Security: XML_PARSE_NONET (no network), no entity
 * substitution (NOENT not set), DTD loading disabled by default, and the
 * WASM runtime has no filesystem/network access of its own — schema files are
 * fed explicitly from resources/xsd.
 */
import { XmlDocument, XsdValidator, ParseOption } from 'libxml2-wasm';
import { xmlRegisterFsInputProviders } from 'libxml2-wasm/lib/nodejs.mjs';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/** Pick the schema by document root: Invoice, CreditNote or DebitNote. */
function mainXsdFor(xml) {
  const root = xml.match(/<([A-Za-z]+)[\s>]/)?.[1];
  const byRoot = {
    Invoice: 'UBL-Invoice-2.1.xsd',
    CreditNote: 'UBL-CreditNote-2.1.xsd',
    DebitNote: 'UBL-DebitNote-2.1.xsd',
  };
  return path.join('resources', 'xsd', 'maindoc', byRoot[root] ?? 'UBL-Invoice-2.1.xsd');
}

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
}

function output(result) {
  process.stdout.write(JSON.stringify(result));
}

const xml = await readStdin();

let doc;
try {
  doc = XmlDocument.fromString(xml, { option: ParseOption.XML_PARSE_NONET });
} catch (error) {
  output({
    valid: false,
    errors: (error.details ?? [{ message: error.message }]).map((d) => ({
      message: d.message?.trim() ?? String(d),
      line: d.line,
      column: d.col,
    })),
  });
  process.exit(0);
}

try {
  xmlRegisterFsInputProviders();
  const xsdMain = mainXsdFor(xml);
  const xsdDoc = XmlDocument.fromBuffer(fs.readFileSync(xsdMain), { url: xsdMain });
  const validator = XsdValidator.fromDoc(xsdDoc);
  try {
    validator.validate(doc);
    output({ valid: true, errors: [] });
  } catch (error) {
    output({
      valid: false,
      errors: (error.details ?? [{ message: error.message }]).map((d) => ({
        message: d.message?.trim() ?? String(d),
        line: d.line,
        column: d.col,
      })),
    });
  } finally {
    validator.dispose();
    xsdDoc.dispose();
  }
} finally {
  doc.dispose();
}
