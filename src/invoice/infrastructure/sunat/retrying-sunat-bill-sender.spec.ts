import type {
  SunatBillSender,
  SunatSendResult,
} from '../../application/ports/sunat-bill-sender.port';
import {
  RetryingSunatBillSender,
  isTransientSunatError,
} from './retrying-sunat-bill-sender';
import { SunatSoapFaultError } from './sunat-soap-client';

const ok: SunatSendResult = {
  cdr: { responseCode: '0', description: 'ok', notes: [], accepted: true },
  cdrZipBase64: '',
};

function sender(behaviour: () => Promise<SunatSendResult>): SunatBillSender {
  return { send: behaviour, getStatusCdr: behaviour };
}

describe('isTransientSunatError', () => {
  it('treats network/HTTP 5xx/401 as transient, SOAP faults as permanent', () => {
    expect(isTransientSunatError(new Error('SUNAT HTTP 500: x'))).toBe(true);
    expect(isTransientSunatError(new Error('SUNAT HTTP 401: nginx'))).toBe(
      true,
    );
    expect(isTransientSunatError(new Error('fetch failed'))).toBe(true);
    expect(
      isTransientSunatError(new SunatSoapFaultError('2335', 'ya existe')),
    ).toBe(false);
  });
});

describe('RetryingSunatBillSender', () => {
  it('retries transient errors and eventually succeeds', async () => {
    let calls = 0;
    const inner = sender(() => {
      calls += 1;
      if (calls < 3) return Promise.reject(new Error('SUNAT HTTP 401: nginx'));
      return Promise.resolve(ok);
    });
    const retrying = new RetryingSunatBillSender(inner, 3, 1, () =>
      Promise.resolve(),
    );
    await expect(retrying.send('f.zip', Buffer.from('x'))).resolves.toEqual(ok);
    expect(calls).toBe(3);
  });

  it('does not retry SOAP faults', async () => {
    let calls = 0;
    const inner = sender(() => {
      calls += 1;
      return Promise.reject(new SunatSoapFaultError('2335', 'ya existe'));
    });
    const retrying = new RetryingSunatBillSender(inner, 3, 1, () =>
      Promise.resolve(),
    );
    await expect(retrying.send('f.zip', Buffer.from('x'))).rejects.toThrow(
      SunatSoapFaultError,
    );
    expect(calls).toBe(1);
  });

  it('gives up after the configured attempts', async () => {
    let calls = 0;
    const inner = sender(() => {
      calls += 1;
      return Promise.reject(new Error('fetch failed'));
    });
    const retrying = new RetryingSunatBillSender(inner, 2, 1, () =>
      Promise.resolve(),
    );
    await expect(retrying.send('f.zip', Buffer.from('x'))).rejects.toThrow(
      'fetch failed',
    );
    expect(calls).toBe(2);
  });
});
