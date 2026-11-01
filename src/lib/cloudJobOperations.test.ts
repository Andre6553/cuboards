import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Job } from '../types';
import { shouldAcceptLocalWrite, upsertCloudJobIfNotStale } from './cloudJobOperations';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock('./supabaseClient', () => ({
  getSupabase: () => supabaseMock,
}));

function job(updatedAt: string): Job {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    updatedAt,
    client: { name: 'Test', ref: '', address: '', phone: '', notes: '' },
    materials: [],
    edgingMaterials: [],
    units: [],
    settings: {} as Job['settings'],
  };
}

describe('shouldAcceptLocalWrite', () => {
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

describe('upsertCloudJobIfNotStale RPC path', () => {
  beforeEach(() => {
    supabaseMock.rpc.mockReset();
    supabaseMock.from.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uses atomic RPC result when deployed', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: 'ok', error: null });
    const result = await upsertCloudJobIfNotStale('user-1', job('2026-11-01T12:00:00.000Z'));
    expect(result).toBe('ok');
    expect(supabaseMock.rpc).toHaveBeenCalledWith('cuboards_upsert_job_if_not_stale', {
      p_job_id: job('2026-11-01T12:00:00.000Z').id,
      p_data: job('2026-11-01T12:00:00.000Z'),
      p_updated_at: '2026-11-01T12:00:00.000Z',
    });
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('returns conflict from RPC without table fallback', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: 'conflict', error: null });
    const result = await upsertCloudJobIfNotStale('user-1', job('2026-11-01T12:00:00.000Z'));
    expect(result).toBe('conflict');
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});
