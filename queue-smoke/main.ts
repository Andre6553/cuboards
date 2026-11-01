import type { Job } from '../src/types';
import { setCloudSyncTestHooks } from '../src/lib/cloudJobOperations';
import {
  enqueueCloudJobDelete,
  enqueueCloudJobUpsert,
  flushCloudJobQueue,
  getCloudJobQueueSnapshot,
  processCloudJobQueue,
  startCloudJobQueue,
  stopCloudJobQueue,
} from '../src/lib/cloudJobQueue';
import { listQueueRecordsForUser } from '../src/lib/cloudJobQueueDb';

const userId = 'smoke-user-id';
const resultsEl = document.querySelector('#results')!;

function log(name: string, pass: boolean, detail?: string) {
  const li = document.createElement('li');
  li.className = pass ? 'pass' : 'fail';
  li.textContent = `${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? `: ${detail}` : ''}`;
  resultsEl.appendChild(li);
}

function job(id: string, updatedAt: string): Job {
  return {
    id,
    updatedAt,
    client: { name: 'Smoke', ref: '', address: '', phone: '', notes: '' },
    materials: [],
    edgingMaterials: [],
    units: [],
    settings: {} as Job['settings'],
  };
}

let offline = false;
const upsertLog: string[] = [];

setCloudSyncTestHooks({
  upsertCloudJobIfNotStale: async (_uid, j) => {
    if (offline) throw new Error('offline');
    upsertLog.push(j.updatedAt);
    return 'ok';
  },
  deleteCloudJobIfNotStale: async () => {
    if (offline) throw new Error('offline');
    return 'ok';
  },
});

async function run() {
  stopCloudJobQueue();
  startCloudJobQueue(userId);

  offline = true;
  await enqueueCloudJobUpsert(userId, job('smoke-1', '2026-11-01T10:00:00.000Z'));
  const offlineRows = await listQueueRecordsForUser(userId);
  log('offline save persists to IndexedDB', offlineRows.length === 1);

  offline = false;
  await processCloudJobQueue();
  log('reconnect drains queue', (await listQueueRecordsForUser(userId)).length === 0);
  log('reconnect upsert ran', upsertLog.includes('2026-11-01T10:00:00.000Z'));

  offline = true;
  await enqueueCloudJobUpsert(userId, job('smoke-2', '2026-11-01T11:00:00.000Z'));
  stopCloudJobQueue();
  const beforeRestart = await getCloudJobQueueSnapshot(userId);
  startCloudJobQueue(userId);
  const afterRestart = await getCloudJobQueueSnapshot(userId);
  log(
    'browser restart keeps queued ops',
    beforeRestart.length === 1 && afterRestart.length === 1 && afterRestart[0].jobId === 'smoke-2',
  );

  offline = false;
  await flushCloudJobQueue();
  log('post-restart flush', (await listQueueRecordsForUser(userId)).length === 0);

  await enqueueCloudJobUpsert(userId, job('smoke-del', '2026-11-01T12:00:00.000Z'));
  await enqueueCloudJobDelete(userId, job('smoke-del', '2026-11-01T12:00:00.000Z'));
  const delRow = await listQueueRecordsForUser(userId);
  log('deletion coalesced to delete op', delRow.length === 1 && delRow[0].kind === 'delete');

  offline = false;
  await processCloudJobQueue();
  log('delete processed', (await listQueueRecordsForUser(userId)).length === 0);

  offline = true;
  upsertLog.length = 0;
  await enqueueCloudJobUpsert(userId, job('smoke-rec', '2026-11-01T13:00:00.000Z'));
  offline = false;
  await processCloudJobQueue();
  log('recovery after offline edit', upsertLog.includes('2026-11-01T13:00:00.000Z'));
}

void run().catch((e) => {
  log('runner crashed', false, e instanceof Error ? e.message : String(e));
});
