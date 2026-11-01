import type { Job } from '../types';
import {
  deleteCloudJob,
  fetchCloudJobById,
  upsertCloudJobIfNotStale,
  type CloudUpsertResult,
} from './cloudJobOperations';
import {
  type CloudJobQueueRecord,
  deleteQueueRecord,
  listQueueRecordsForUser,
  putQueueRecord,
  queueRecordKey,
  type MemoryCloudJobQueueStore,
} from './cloudJobQueueDb';

export type CloudSaveStatus = 'idle' | 'pending' | 'syncing' | 'error';

export const MAX_CLOUD_SYNC_ATTEMPTS = 8;

export function computeRetryDelayMs(attempts: number): number {
  const base = 1000 * 2 ** Math.min(attempts, 6);
  return Math.min(30_000, base);
}

export function mergeQueueStatus(records: CloudJobQueueRecord[], processing: boolean): CloudSaveStatus {
  if (processing) return 'syncing';
  if (records.some((r) => r.attempts >= MAX_CLOUD_SYNC_ATTEMPTS)) return 'error';
  if (records.length > 0) return 'pending';
  return 'idle';
}

type QueueStore = {
  put: (record: CloudJobQueueRecord) => Promise<void>;
  delete: (key: string) => Promise<void>;
  listForUser: (userId: string) => Promise<CloudJobQueueRecord[]>;
};

let activeStore: QueueStore = {
  put: putQueueRecord,
  delete: deleteQueueRecord,
  listForUser: listQueueRecordsForUser,
};

let activeUserId: string | null = null;
let processTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let processing = false;
let statusListener: ((status: CloudSaveStatus) => void) | null = null;
let drainedListener: (() => void) | null = null;
let remoteNewerListener: ((job: Job) => void) | null = null;

/** Test hook — swap IndexedDB for in-memory store. */
export function setCloudJobQueueStoreForTests(store: MemoryCloudJobQueueStore | null): void {
  if (store) {
    activeStore = store;
  } else {
    activeStore = {
      put: putQueueRecord,
      delete: deleteQueueRecord,
      listForUser: listQueueRecordsForUser,
    };
  }
}

export function setCloudSaveStatusListener(fn: ((status: CloudSaveStatus) => void) | null): void {
  statusListener = fn;
}

export function setCloudQueueDrainedListener(fn: (() => void) | null): void {
  drainedListener = fn;
}

export function setCloudRemoteNewerListener(fn: ((job: Job) => void) | null): void {
  remoteNewerListener = fn;
}

async function emitStatus(userId: string): Promise<void> {
  const records = await activeStore.listForUser(userId);
  statusListener?.(mergeQueueStatus(records, processing));
}

function scheduleProcessDebounced(delayMs = 600): void {
  if (!activeUserId) return;
  if (processTimer) clearTimeout(processTimer);
  processTimer = setTimeout(() => {
    processTimer = null;
    void processCloudJobQueue();
  }, delayMs);
}

function scheduleRetryAt(whenMs: number): void {
  if (retryTimer) clearTimeout(retryTimer);
  const delay = Math.max(0, whenMs - Date.now());
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void processCloudJobQueue();
  }, delay);
}

export async function enqueueCloudJobUpsert(userId: string, job: Job): Promise<void> {
  const key = queueRecordKey(userId, job.id);
  const existing = await activeStore.listForUser(userId);
  const prev = existing.find((r) => r.key === key);
  const record: CloudJobQueueRecord = {
    key,
    userId,
    jobId: job.id,
    kind: 'upsert',
    jobJson: JSON.stringify(job),
    updatedAt: job.updatedAt,
    attempts:
      prev?.kind === 'upsert' && prev.updatedAt === job.updatedAt ? prev.attempts : 0,
    nextRetryAt: Date.now(),
    lastError: undefined,
    createdAt: prev?.createdAt ?? new Date().toISOString(),
  };
  await activeStore.put(record);
  activeUserId = userId;
  void emitStatus(userId);
  scheduleProcessDebounced();
}

export async function enqueueCloudJobDelete(userId: string, jobId: string): Promise<void> {
  const key = queueRecordKey(userId, jobId);
  const record: CloudJobQueueRecord = {
    key,
    userId,
    jobId,
    kind: 'delete',
    updatedAt: new Date().toISOString(),
    attempts: 0,
    nextRetryAt: Date.now(),
    createdAt: new Date().toISOString(),
  };
  await activeStore.put(record);
  activeUserId = userId;
  void emitStatus(userId);
  scheduleProcessDebounced();
}

export function startCloudJobQueue(userId: string | null): void {
  activeUserId = userId;
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
  }
  if (userId) {
    void emitStatus(userId);
    scheduleProcessDebounced(0);
  }
}

export function stopCloudJobQueue(): void {
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', onOnline);
  }
  activeUserId = null;
  if (processTimer) clearTimeout(processTimer);
  if (retryTimer) clearTimeout(retryTimer);
  processTimer = null;
  retryTimer = null;
}

function onOnline(): void {
  scheduleProcessDebounced(0);
}

async function applyOp(record: CloudJobQueueRecord): Promise<'done' | 'conflict'> {
  if (record.kind === 'delete') {
    await deleteCloudJob(record.userId, record.jobId);
    return 'done';
  }
  const job = JSON.parse(record.jobJson ?? '{}') as Job;
  const result: CloudUpsertResult = await upsertCloudJobIfNotStale(record.userId, job);
  if (result === 'ok') return 'done';
  const remote = await fetchCloudJobById(record.userId, record.jobId);
  if (remote) remoteNewerListener?.(remote);
  return 'conflict';
}

export async function processCloudJobQueue(): Promise<void> {
  const userId = activeUserId;
  if (!userId || processing) return;

  const records = await activeStore.listForUser(userId);
  if (records.length === 0) {
    statusListener?.('idle');
    return;
  }

  const now = Date.now();
  const ready = records
    .filter((r) => r.nextRetryAt <= now && r.attempts < MAX_CLOUD_SYNC_ATTEMPTS)
    .sort((a, b) => a.nextRetryAt - b.nextRetryAt || a.createdAt.localeCompare(b.createdAt));

  if (ready.length === 0) {
    const nextAt = Math.min(...records.map((r) => r.nextRetryAt));
    statusListener?.(mergeQueueStatus(records, false));
    scheduleRetryAt(nextAt);
    return;
  }

  processing = true;
  statusListener?.('syncing');

  let hadFailure = false;
  let earliestRetry = Infinity;

  for (const record of ready) {
    try {
      const outcome = await applyOp(record);
      if (outcome === 'done' || outcome === 'conflict') {
        await activeStore.delete(record.key);
        continue;
      }
      hadFailure = true;
    } catch (e) {
      hadFailure = true;
      const attempts = record.attempts + 1;
      const nextRetryAt = Date.now() + computeRetryDelayMs(attempts);
      earliestRetry = Math.min(earliestRetry, nextRetryAt);
      const message = e instanceof Error ? e.message : String(e);
      await activeStore.put({
        ...record,
        attempts,
        nextRetryAt,
        lastError: message,
      });
    }
  }

  processing = false;
  const remaining = await activeStore.listForUser(userId);
  const status = mergeQueueStatus(remaining, false);
  statusListener?.(status);

  if (remaining.length === 0 && !hadFailure) {
    drainedListener?.();
  } else if (hadFailure) {
    scheduleRetryAt(earliestRetry === Infinity ? Date.now() + 2000 : earliestRetry);
  } else if (remaining.some((r) => r.nextRetryAt > Date.now())) {
    scheduleRetryAt(Math.min(...remaining.map((r) => r.nextRetryAt)));
  } else if (remaining.length > 0) {
    scheduleProcessDebounced(0);
  }
}

/** Wait until the queue is empty or attempts are exhausted (for manual sync). */
export async function flushCloudJobQueue(): Promise<void> {
  const userId = activeUserId;
  if (!userId) return;
  for (let i = 0; i < 20; i++) {
    await processCloudJobQueue();
    const records = await activeStore.listForUser(userId);
    if (records.length === 0) return;
    const blocked = records.every((r) => r.nextRetryAt > Date.now());
    if (blocked) {
      await new Promise((r) => setTimeout(r, Math.min(...records.map((x) => x.nextRetryAt)) - Date.now() + 50));
    }
  }
}

export async function getCloudJobQueueSnapshot(userId: string): Promise<CloudJobQueueRecord[]> {
  return activeStore.listForUser(userId);
}
