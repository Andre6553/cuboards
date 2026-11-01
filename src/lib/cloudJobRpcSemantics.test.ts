import { describe, expect, it } from 'vitest';
import { resolveUpsertAfterConditionalWrite, shouldAcceptLocalWrite } from './cloudJobOperations';

describe('RPC conflict semantics (mirrors 0010 migration)', () => {
  it('allows equal timestamps for concurrent edits', () => {
    const ts = '2026-11-01T12:00:00.000Z';
    expect(shouldAcceptLocalWrite(ts, ts)).toBe(true);
    expect(resolveUpsertAfterConditionalWrite(ts, ts, ts)).toBe('ok');
  });

  it('rejects strictly newer remote timestamps', () => {
    expect(
      shouldAcceptLocalWrite('2026-11-01T13:00:00.000Z', '2026-11-01T12:00:00.000Z'),
    ).toBe(false);
    expect(
      resolveUpsertAfterConditionalWrite(
        '2026-11-01T13:00:00.000Z',
        '2026-11-01T12:00:00.000Z',
        null,
      ),
    ).toBe('conflict');
  });

  it('accepts simultaneous create when first writer returns row', () => {
    const ts = '2026-11-01T12:00:00.000Z';
    expect(resolveUpsertAfterConditionalWrite(null, ts, ts)).toBe('ok');
  });

  it('resolves concurrent upsert when conditional update no-ops but timestamps tie', () => {
    const ts = '2026-11-01T12:00:00.000Z';
    expect(resolveUpsertAfterConditionalWrite(ts, ts, null)).toBe('ok');
  });

  it('resolves concurrent upsert conflict when remote moved ahead during lock wait', () => {
    expect(
      resolveUpsertAfterConditionalWrite(
        '2026-11-01T14:00:00.000Z',
        '2026-11-01T12:00:00.000Z',
        null,
      ),
    ).toBe('conflict');
  });
});
