import { describe, expect, it } from 'vitest';
import {
  computeRetryDelayMs,
  mergeQueueStatus,
  MAX_CLOUD_SYNC_ATTEMPTS,
  pickNextRetryAtMs,
} from './cloudJobQueue';
import type { CloudJobQueueRecord } from './cloudJobQueueDb';

function record(partial: Partial<CloudJobQueueRecord>): CloudJobQueueRecord {
  return {
    key: 'u:j',
    userId: 'u',
    jobId: 'j',
    kind: 'upsert',
    updatedAt: '2026-01-01T00:00:00.000Z',
    attempts: 0,
    nextRetryAt: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    revision: 0,
    ...partial,
  };
}

describe('computeRetryDelayMs', () => {
  it('caps delay at 30 seconds', () => {
    expect(computeRetryDelayMs(10)).toBe(30_000);
  });

  it('doubles with attempts', () => {
    expect(computeRetryDelayMs(0)).toBe(1000);
    expect(computeRetryDelayMs(1)).toBe(2000);
    expect(computeRetryDelayMs(2)).toBe(4000);
  });
});

describe('mergeQueueStatus', () => {
  it('prefers syncing when processor is active', () => {
    expect(mergeQueueStatus([record({})], true)).toBe('syncing');
  });

  it('reports error when an op exhausted retries', () => {
    expect(
      mergeQueueStatus([record({ attempts: MAX_CLOUD_SYNC_ATTEMPTS })], false),
    ).toBe('error');
  });

  it('reports pending when ops remain', () => {
    expect(mergeQueueStatus([record({})], false)).toBe('pending');
  });

  it('reports idle when queue is empty', () => {
    expect(mergeQueueStatus([], false)).toBe('idle');
  });
});

describe('pickNextRetryAtMs', () => {
  it('returns null when every op exhausted attempts', () => {
    const now = 1_000_000;
    expect(
      pickNextRetryAtMs([record({ attempts: MAX_CLOUD_SYNC_ATTEMPTS, nextRetryAt: now - 1 })], now),
    ).toBeNull();
  });

  it('returns null when retryable ops are already due', () => {
    const now = 1_000_000;
    expect(pickNextRetryAtMs([record({ nextRetryAt: now - 500 })], now)).toBeNull();
  });

  it('returns earliest future retry among retryable ops', () => {
    const now = 1_000_000;
    expect(
      pickNextRetryAtMs(
        [
          record({ nextRetryAt: now + 5000 }),
          record({ nextRetryAt: now + 2000 }),
          record({ attempts: MAX_CLOUD_SYNC_ATTEMPTS, nextRetryAt: now + 100 }),
        ],
        now,
      ),
    ).toBe(now + 2000);
  });
});
