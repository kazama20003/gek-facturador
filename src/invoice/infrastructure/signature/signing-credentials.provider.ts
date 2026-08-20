import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SigningCredentials } from './xmldsig-invoice-signer';

const DEFAULT_KEY = join('test', 'fixtures', 'certs', 'test-key.pem');
const DEFAULT_CERT = join('test', 'fixtures', 'certs', 'test-cert.pem');

/**
 * Loads the signing key/certificate from SIGN_KEY_PATH / SIGN_CERT_PATH.
 * Falls back to the committed self-signed TEST certificate (valid only for
 * development and SUNAT beta) and warns loudly — never ship that default.
 */
export function loadSigningCredentials(
  env: NodeJS.ProcessEnv = process.env,
): SigningCredentials {
  const keyPath = env.SIGN_KEY_PATH ?? DEFAULT_KEY;
  const certPath = env.SIGN_CERT_PATH ?? DEFAULT_CERT;

  if (!env.SIGN_KEY_PATH || !env.SIGN_CERT_PATH) {
    console.warn(
      '[emitec] SIGN_KEY_PATH/SIGN_CERT_PATH not set — using the bundled SELF-SIGNED TEST certificate. Do not use in production.',
    );
  }

  return {
    privateKeyPem: readFileSync(keyPath, 'utf8'),
    certificatePem: readFileSync(certPath, 'utf8'),
  };
}
