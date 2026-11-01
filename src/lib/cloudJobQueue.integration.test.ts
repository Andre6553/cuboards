import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job } from '../types';
import { MemoryCloudJobQueueStore } from './cloudJobQueueDb';
import {
  enqueueCloudJobDelete,
  enqueueCloudJobUpsert,
  processCloudJobQueue,
  setCloudJobQueueStoreForTests,
  setCloudRemoteNewerListener,
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
    setCloudRemoteNewerListener(null);
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

  it('coalesces upsert then delete for the same job id', async () => {
    const deletedJob = job('j1');
    await enqueueCloudJobUpsert(userId, deletedJob);
    await enqueueCloudJobDelete(userId, deletedJob);
    const remaining = await store.listForUser(userId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].kind).toBe('delete');
    expect(remaining[0].updatedAt).toBe(deletedJob.updatedAt);
  });

  it('drops upsert when cloud reports a newer remote (conflict)', async () => {
    vi.mocked(ops.upsertCloudJobIfNotStale).mockResolvedValue('conflict');
    vi.spyOn(ops, 'fetchCloudJobById').mockResolvedValue(job('j1'));
    await enqueueCloudJobUpsert(userId, job('j1'));
    await processCloudJobQueue();
    expect(await store.listForUser(userId)).toHaveLength(0);
  });

  it('does not delete a newer cloud job when a stale local delete is queued', async () => {
    const deletedJob = job('j1');
    const remoteJob = { ...deletedJob, updatedAt: '2026-01-02T13:00:00.000Z' };
    const remoteNewer: Job[] = [];
    vi.spyOn(ops, 'deleteCloudJobIfNotStale').mockResolvedValue('conflict');
    vi.spyOn(ops, 'fetchCloudJobById').mockResolvedValue(remoteJob);
    setCloudRemoteNewerListener((nextJob) => remoteNewer.push(nextJob));

    await enqueueCloudJobDelete(userId, deletedJob);
    await processCloudJobQueue();

    expect(ops.deleteCloudJobIfNotStale).toHaveBeenCalledWith(userId, deletedJob.id, deletedJob.updatedAt);
    expect(remoteNewer).toEqual([remoteJob]);
    expect(await store.listForUser(userId)).toHaveLength(0);
  });
});
