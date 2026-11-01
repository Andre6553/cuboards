/** IndexedDB persistence for durable cloud job sync operations. */

export type CloudJobQueueKind = 'upsert' | 'delete';

export interface CloudJobQueueRecord {
  key: string;
  userId: string;
  jobId: string;
  kind: CloudJobQueueKind;
  /** Serialized Job for upsert ops. */
  jobJson?: string;
  /** Job.updatedAt at enqueue time — used for conflict checks. */
  updatedAt: string;
  attempts: number;
  nextRetryAt: number;
  lastError?: string;
  createdAt: string;
  /** Monotonic per key; bumped on every enqueue so in-flight ops cannot drop superseding edits. */
  revision: number;
}

const DB_NAME = 'cuboards-cloud-sync-v1';
const DB_VERSION = 1;
const STORE = 'job_ops';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('by_user', 'userId', { unique: false });
        store.createIndex('by_user_retry', ['userId', 'nextRetryAt'], { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

export function queueRecordKey(userId: string, jobId: string): string {
  return `${userId}:${jobId}`;
}

export async function putQueueRecord(record: CloudJobQueueRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB put failed'));
    };
  });
}

export type QueueRevisionCommitResult = 'committed' | 'superseded';

/** Read revision and delete in a single readwrite transaction (atomic commit). */
export async function deleteQueueRecordIfRevisionMatches(
  key: string,
  revision: number,
): Promise<QueueRevisionCommitResult> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    let outcome: QueueRevisionCommitResult = 'superseded';
    const req = store.get(key);
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error('IndexedDB get failed'));
    };
    req.onsuccess = () => {
      const record = req.result as CloudJobQueueRecord | undefined;
      if (record && record.revision === revision) {
        store.delete(key);
        outcome = 'committed';
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(outcome);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB revision commit failed'));
    };
  });
}

export async function deleteQueueRecord(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB delete failed'));
    };
  });
}

export async function getQueueRecord(key: string): Promise<CloudJobQueueRecord | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => {
      db.close();
      resolve(req.result as CloudJobQueueRecord | undefined);
    };
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error('IndexedDB get failed'));
    };
  });
}

export async function listQueueRecordsForUser(userId: string): Promise<CloudJobQueueRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const index = tx.objectStore(STORE).index('by_user');
    const req = index.getAll(userId);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as CloudJobQueueRecord[]) ?? []);
    };
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error('IndexedDB list failed'));
    };
  });
}

export async function clearQueueRecordsForUser(userId: string): Promise<void> {
  const records = await listQueueRecordsForUser(userId);
  if (records.length === 0) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const r of records) store.delete(r.key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB clear failed'));
    };
  });
}

/** In-memory store for unit tests (no IndexedDB). */
export class MemoryCloudJobQueueStore {
  private map = new Map<string, CloudJobQueueRecord>();

  async put(record: CloudJobQueueRecord): Promise<void> {
    this.map.set(record.key, { ...record });
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async deleteIfRevisionMatches(key: string, revision: number): Promise<QueueRevisionCommitResult> {
    const record = this.map.get(key);
    if (!record || record.revision !== revision) return 'superseded';
    this.map.delete(key);
    return 'committed';
  }

  async get(key: string): Promise<CloudJobQueueRecord | undefined> {
    const r = this.map.get(key);
    return r ? { ...r } : undefined;
  }

  async listForUser(userId: string): Promise<CloudJobQueueRecord[]> {
    return [...this.map.values()].filter((r) => r.userId === userId).map((r) => ({ ...r }));
  }

  async clearUser(userId: string): Promise<void> {
    for (const [k, r] of this.map) {
      if (r.userId === userId) this.map.delete(k);
    }
  }
}
