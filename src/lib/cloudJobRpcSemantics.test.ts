import { describe, expect, it } from 'vitest';
import type { Job } from '../types';
import { resolveUpsertAfterConditionalWrite, shouldAcceptJobUpsert } from './cloudJobOperations';

function job(name: string, updatedAt: string): Job {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    updatedAt,
    client: { name, ref: '', address: '', phone: '', notes: '' },
    materials: [],
    edgingMaterials: [],
    units: [],
    settings: {} as Job['settings'],
  };
}

describe('RPC conflict semantics (mirrors 0010 migration)', () => {
  it('allows equal timestamps when payload is identical', () => {
    const ts = '2026-11-01T12:00:00.000Z';
    const body = job('Same', ts);
    expect(shouldAcceptJobUpsert(ts, body, body)).toBe(true);
    expect(resolveUpsertAfterConditionalWrite(ts, ts, ts, body, body)).toBe('ok');
  });

  it('conflicts on equal timestamps with different payloads', () => {
    const ts = '2026-11-01T12:00:00.000Z';
    expect(shouldAcceptJobUpsert(ts, job('Remote', ts), job('Local', ts))).toBe(false);
    expect(resolveUpsertAfterConditionalWrite(ts, ts, null, job('Remote', ts), job('Local', ts))).toBe(
      'conflict',
    );
  });

  it('rejects strictly newer remote timestamps', () => {
    expect(
      shouldAcceptJobUpsert('2026-11-01T13:00:00.000Z', job('R', '2026-11-01T13:00:00.000Z'), job('L', '2026-11-01T12:00:00.000Z')),
    ).toBe(false);
  });

  it('accepts simultaneous create when first writer returns row', () => {
    const ts = '2026-11-01T12:00:00.000Z';
    expect(resolveUpsertAfterConditionalWrite(null, ts, ts, null, job('New', ts))).toBe('ok');
  });

  it('resolves concurrent upsert conflict when remote moved ahead during lock wait', () => {
    expect(
      resolveUpsertAfterConditionalWrite(
        '2026-11-01T14:00:00.000Z',
        '2026-11-01T12:00:00.000Z',
        null,
        job('Remote', '2026-11-01T14:00:00.000Z'),
        job('Local', '2026-11-01T12:00:00.000Z'),
      ),
    ).toBe('conflict');
  });
});
