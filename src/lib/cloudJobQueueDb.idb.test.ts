/**
 * @vitest-environment node
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearQueueRecordsForUser,
  deleteQueueRecordIfRevisionMatches,
  listQueueRecordsForUser,
  putQueueRecord,
  queueRecordKey,
  type CloudJobQueueRecord,
} from './cloudJobQueueDb';

const userId = 'browser-user';
const jobId = 'job-a';
const key = queueRecordKey(userId, jobId);

function record(revision: number, updatedAt: string): CloudJobQueueRecord {
  return {
    key,
    userId,
    jobId,
    kind: 'upsert',
    jobJson: '{}',
    updatedAt,
    attempts: 0,
    nextRetryAt: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    revision,
  };
}

describe('IndexedDB revision commit (real IDB via fake-indexeddb)', () => {
  beforeEach(async () => {
    await clearQueueRecordsForUser(userId);
  });

  it('commits delete only when revision still matches', async () => {
    await putQueueRecord(record(1, '2026-01-01T00:00:00.000Z'));
    expect(await deleteQueueRecordIfRevisionMatches(key, 1)).toBe('committed');
    expect(await listQueueRecordsForUser(userId)).toHaveLength(0);
  });

  it('returns superseded without deleting when revision advanced', async () => {
    await putQueueRecord(record(1, '2026-01-01T00:00:00.000Z'));
    await putQueueRecord(record(2, '2026-01-02T00:00:00.000Z'));
    expect(await deleteQueueRecordIfRevisionMatches(key, 1)).toBe('superseded');
    const remaining = await listQueueRecordsForUser(userId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].revision).toBe(2);
  });
});
