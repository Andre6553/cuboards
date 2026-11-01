import { describe, expect, it } from 'vitest';

/** Mirrors upsertCloudJobIfNotStale without hitting Supabase. */
function shouldAcceptLocalWrite(remoteUpdatedAt: string | null, localUpdatedAt: string): boolean {
  if (!remoteUpdatedAt) return true;
  return remoteUpdatedAt.localeCompare(localUpdatedAt) <= 0;
}

describe('upsertCloudJobIfNotStale conflict rule', () => {
  it('accepts insert when remote row is missing', () => {
    expect(shouldAcceptLocalWrite(null, '2026-11-01T12:00:00.000Z')).toBe(true);
  });

  it('accepts equal or newer local timestamps', () => {
    expect(shouldAcceptLocalWrite('2026-11-01T12:00:00.000Z', '2026-11-01T12:00:00.000Z')).toBe(true);
    expect(shouldAcceptLocalWrite('2026-11-01T11:00:00.000Z', '2026-11-01T12:00:00.000Z')).toBe(true);
  });

  it('rejects overwrite when remote is newer', () => {
    expect(shouldAcceptLocalWrite('2026-11-01T13:00:00.000Z', '2026-11-01T12:00:00.000Z')).toBe(false);
  });
});
