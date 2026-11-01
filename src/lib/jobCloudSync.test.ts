import { describe, expect, it } from 'vitest';
import type { Job } from '../types';
import { mergeJobLists } from './jobCloudSync';

function job(id: string, updatedAt: string): Job {
  return {
    id,
    updatedAt,
    client: { name: id, ref: '', address: '', phone: '', notes: '' },
    materials: [],
    edgingMaterials: [],
    units: [],
    settings: {} as Job['settings'],
  };
}

describe('mergeJobLists', () => {
  it('keeps the newer copy for the same id', () => {
    const local = [job('a', '2026-01-02T00:00:00.000Z')];
    const remote = [job('a', '2026-01-01T00:00:00.000Z')];
    const merged = mergeJobLists(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].updatedAt).toBe('2026-01-02T00:00:00.000Z');
  });

  it('union jobs by id and sorts by updatedAt desc', () => {
    const local = [job('a', '2026-01-01T00:00:00.000Z')];
    const remote = [job('b', '2026-01-03T00:00:00.000Z')];
    const merged = mergeJobLists(local, remote);
    expect(merged.map((j) => j.id)).toEqual(['b', 'a']);
  });
});
