import { execFile } from 'node:child_process';
import path from 'node:path';
import type {
  UblXmlValidator,
  XmlValidationResult,
} from '../../../invoice/application/ports/ubl-xml-validator.port';

const SCRIPT = path.join('scripts', 'validate-ubl-xsd.mjs');
const TIMEOUT_MS = 30_000;

/**
 * Validates UBL XML against the official OASIS UBL 2.1 XSDs (resources/xsd)
 * by delegating to a short-lived Node child process running libxml2-wasm.
 * See scripts/validate-ubl-xsd.mjs for the rationale and security settings.
 */
export class ChildProcessUblXmlValidator implements UblXmlValidator {
  constructor(private readonly projectRoot: string = process.cwd()) {}

  validate(xml: string): Promise<XmlValidationResult> {
    return new Promise((resolve, reject) => {
      const child = execFile(
        process.execPath,
        [SCRIPT],
        {
          cwd: this.projectRoot,
          timeout: TIMEOUT_MS,
          maxBuffer: 10 * 1024 * 1024,
        },
        (error, stdout) => {
          if (error && !stdout) {
            reject(
              new Error(`XSD validation process failed: ${error.message}`),
            );
            return;
          }
          try {
            resolve(JSON.parse(stdout) as XmlValidationResult);
          } catch {
            reject(
              new Error(
                `XSD validation returned invalid output: ${stdout.slice(0, 500)}`,
              ),
            );
          }
        },
      );
      child.stdin?.end(xml, 'utf8');
    });
  }
}
