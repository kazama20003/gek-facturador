import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCredentialsFromPfx } from './pfx-credentials.loader';
import type { SigningCredentials } from './xmldsig-invoice-signer';

const DEFAULT_KEY = join('test', 'fixtures', 'certs', 'test-key.pem');
const DEFAULT_CERT = join('test', 'fixtures', 'certs', 'test-cert.pem');

/**
 * Loads the signing credentials, in order of precedence:
 * 1. SIGN_PFX_PATH + SIGN_PFX_PASSWORD (PKCS#12, format used by tax certs)
 * 2. SIGN_KEY_PATH + SIGN_CERT_PATH (PEM)
 * 3. The committed self-signed TEST certificate (dev/beta only) with a loud warning.
 */
export function loadSigningCredentials(
  env: NodeJS.ProcessEnv = process.env,
): SigningCredentials {
  if (env.SIGN_PFX_PATH) {
    return loadCredentialsFromPfx(
      env.SIGN_PFX_PATH,
      env.SIGN_PFX_PASSWORD ?? '',
    );
  }

  if (env.SIGN_KEY_PATH && env.SIGN_CERT_PATH) {
    return {
      privateKeyPem: readFileSync(env.SIGN_KEY_PATH, 'utf8'),
      certificatePem: readFileSync(env.SIGN_CERT_PATH, 'utf8'),
    };
  }

  console.warn(
    '[emitec] No signing credentials configured (SIGN_PFX_PATH or SIGN_KEY_PATH/SIGN_CERT_PATH) — using the bundled SELF-SIGNED TEST certificate. Do not use in production.',
  );
  return {
    privateKeyPem: readFileSync(DEFAULT_KEY, 'utf8'),
    certificatePem: readFileSync(DEFAULT_CERT, 'utf8'),
  };
}
