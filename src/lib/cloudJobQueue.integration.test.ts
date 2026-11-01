import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job } from '../types';
import { MemoryCloudJobQueueStore } from './cloudJobQueueDb';
import {
  enqueueCloudJobUpsert,
  processCloudJobQueue,
  setCloudJobQueueStoreForTests,
  startCloudJobQueue,
  stopCloudJobQueue,
} from './cloudJobQueue';
import * as ops from './cloudJobOperations';

function job(id: string): Job {
  return {
    id,
    updatedAt: '2026-01-02T12:00:00.000Z',
    client: { name: 'Test', ref: '', address: '', phone: '', notes: '' },
    materials: [],
    edgingMaterials: [],
    units: [],
    settings: {} as Job['settings'],
  };
}

describe('cloud job queue processor', () => {
  const userId = 'user-1';
  let store: MemoryCloudJobQueueStore;

  beforeEach(() => {
    store = new MemoryCloudJobQueueStore();
    setCloudJobQueueStoreForTests(store);
    vi.spyOn(ops, 'upsertCloudJobIfNotStale').mockResolvedValue('ok');
    startCloudJobQueue(userId);
  });

  afterEach(() => {
    stopCloudJobQueue();
    setCloudJobQueueStoreForTests(null);
    vi.restoreAllMocks();
  });

  it('drains upsert ops and calls Supabase upsert', async () => {
    await enqueueCloudJobUpsert(userId, job('j1'));
    await processCloudJobQueue();
    expect(ops.upsertCloudJobIfNotStale).toHaveBeenCalledOnce();
    expect(await store.listForUser(userId)).toHaveLength(0);
  });

  it('retries failed ops with backoff metadata', async () => {
    vi.mocked(ops.upsertCloudJobIfNotStale).mockRejectedValueOnce(new Error('network'));
    await enqueueCloudJobUpsert(userId, job('j1'));
    await processCloudJobQueue();
    const remaining = await store.listForUser(userId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].attempts).toBe(1);
    expect(remaining[0].lastError).toBe('network');
    expect(remaining[0].nextRetryAt).toBeGreaterThan(Date.now() - 1000);
  });
});
