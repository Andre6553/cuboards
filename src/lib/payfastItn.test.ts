import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { pfEncode, signFields, verifyItnSignature } from '../../api/_payfast.js';

function buildSignedBody(fields: [string, string][], passphrase?: string): string {
  const signature = signFields(fields, passphrase);
  const pairs = fields.map(([k, v]) => `${k}=${pfEncode(String(v))}`);
  return `${pairs.join('&')}&signature=${signature}`;
}

describe('verifyItnSignature (live PayFast rules)', () => {
  it('accepts ITN when passphrase-signed hash matches', () => {
    const fields: [string, string][] = [
      ['m_payment_id', 'abc123'],
      ['payment_status', 'COMPLETE'],
      ['amount_gross', '500.00'],
    ];
    const passphrase = 'live-secret';
    const raw = buildSignedBody(fields, passphrase);
    expect(verifyItnSignature(raw, passphrase).ok).toBe(true);
  });

  it('rejects param-only MD5 when live passphrase is configured', () => {
    const fields: [string, string][] = [
      ['m_payment_id', 'abc123'],
      ['payment_status', 'COMPLETE'],
    ];
    const passphrase = 'live-secret';
    const signStr = fields.map(([k, v]) => `${k}=${pfEncode(v)}`).join('&');
    const sig = crypto.createHash('md5').update(signStr).digest('hex');
    const raw = `${signStr}&signature=${sig}`;
    expect(verifyItnSignature(raw, passphrase).ok).toBe(false);
  });

  it('accepts param-only signature when no passphrase (sandbox test merchant)', () => {
    const fields: [string, string][] = [
      ['m_payment_id', 'test'],
      ['payment_status', 'COMPLETE'],
    ];
    const signStr = fields.map(([k, v]) => `${k}=${pfEncode(v)}`).join('&');
    const sig = crypto.createHash('md5').update(signStr).digest('hex');
    const raw = `${signStr}&signature=${sig}`;
    expect(verifyItnSignature(raw, undefined).ok).toBe(true);
  });
});
