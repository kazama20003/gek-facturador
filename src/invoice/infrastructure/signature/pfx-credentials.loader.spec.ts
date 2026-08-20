import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCredentialsFromPfx } from './pfx-credentials.loader';

const certDir = join(process.cwd(), 'test', 'fixtures', 'certs');

describe('loadCredentialsFromPfx', () => {
  it('extracts key and certificate from the PKCS#12 container', () => {
    const credentials = loadCredentialsFromPfx(
      join(certDir, 'test-cert.pfx'),
      'emitec-test',
    );

    expect(credentials.privateKeyPem).toContain('BEGIN RSA PRIVATE KEY');
    expect(credentials.certificatePem).toContain('BEGIN CERTIFICATE');
    // same certificate as the PEM fixture (modulo PEM formatting)
    const pemCert = readFileSync(join(certDir, 'test-cert.pem'), 'utf8');
    const normalize = (pem: string) => pem.replace(/\s/g, '');
    expect(normalize(credentials.certificatePem)).toBe(normalize(pemCert));
  });

  it('fails with a wrong password', () => {
    expect(() =>
      loadCredentialsFromPfx(join(certDir, 'test-cert.pfx'), 'wrong'),
    ).toThrow();
  });
});
