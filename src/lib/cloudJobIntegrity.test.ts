import { describe, expect, it } from 'vitest';
import type { Job } from '../types';
import { shouldAcceptJobUpsert } from './cloudJobOperations';
import { jobPayloadsEqual } from './jobSyncFingerprint';

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

describe('equal updatedAt integrity', () => {
  it('accepts idempotent retry when payload matches', () => {
    const ts = '2026-11-01T12:00:00.000Z';
    const local = job('Same', ts);
    const remote = job('Same', ts);
    expect(jobPayloadsEqual(local, remote)).toBe(true);
    expect(shouldAcceptJobUpsert(ts, remote, local)).toBe(true);
  });

  it('conflicts when updatedAt ties but payloads differ', () => {
    const ts = '2026-11-01T12:00:00.000Z';
    const local = job('Local edit', ts);
    const remote = job('Remote edit', ts);
    expect(shouldAcceptJobUpsert(ts, remote, local)).toBe(false);
  });
});
