import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  livePayfastPassphraseConfigured,
  pfEncode,
  signFields,
  verifyItnSignature,
} from '../../api/_payfast.js';

function buildSignedBody(fields: [string, string][], passphrase?: string): string {
  const signature = signFields(fields, passphrase);
  const pairs = fields.map(([k, v]) => `${k}=${pfEncode(String(v))}`);
  return `${pairs.join('&')}&signature=${signature}`;
}

describe('livePayfastPassphraseConfigured', () => {
  it('is false for missing or whitespace passphrase', () => {
    expect(livePayfastPassphraseConfigured(undefined)).toBe(false);
    expect(livePayfastPassphraseConfigured('')).toBe(false);
    expect(livePayfastPassphraseConfigured('   ')).toBe(false);
  });

  it('is true when passphrase has content', () => {
    expect(livePayfastPassphraseConfigured('live-secret')).toBe(true);
  });
});

describe('verifyItnSignature (live PayFast rules)', () => {
  const fields: [string, string][] = [
    ['m_payment_id', 'abc123'],
    ['payment_status', 'COMPLETE'],
    ['amount_gross', '500.00'],
  ];

  it('accepts ITN when passphrase-signed hash matches (liveMode)', () => {
    const passphrase = 'live-secret';
    const raw = buildSignedBody(fields, passphrase);
    expect(verifyItnSignature(raw, passphrase, { liveMode: true }).ok).toBe(true);
  });

  it('rejects live ITN when passphrase is missing even if param-only MD5 would match', () => {
    const signStr = fields.map(([k, v]) => `${k}=${pfEncode(v)}`).join('&');
    const sig = crypto.createHash('md5').update(signStr).digest('hex');
    const raw = `${signStr}&signature=${sig}`;
    const result = verifyItnSignature(raw, undefined, { liveMode: true });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('missing_live_passphrase');
  });

  it('rejects live ITN with incorrect signature when passphrase is set', () => {
    const raw = buildSignedBody(fields, 'correct-pass');
    const result = verifyItnSignature(raw, 'wrong-pass', { liveMode: true });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('signature_mismatch');
  });

  it('rejects param-only MD5 when live passphrase is configured', () => {
    const passphrase = 'live-secret';
    const signStr = fields.map(([k, v]) => `${k}=${pfEncode(v)}`).join('&');
    const sig = crypto.createHash('md5').update(signStr).digest('hex');
    const raw = `${signStr}&signature=${sig}`;
    expect(verifyItnSignature(raw, passphrase, { liveMode: true }).ok).toBe(false);
  });

  it('accepts param-only signature in sandbox when no passphrase', () => {
    const signStr = fields.map(([k, v]) => `${k}=${pfEncode(v)}`).join('&');
    const sig = crypto.createHash('md5').update(signStr).digest('hex');
    const raw = `${signStr}&signature=${sig}`;
    expect(verifyItnSignature(raw, undefined, { liveMode: false }).ok).toBe(true);
  });
});
