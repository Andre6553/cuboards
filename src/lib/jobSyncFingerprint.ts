import type { Job } from '../types';

/** Stable JSON fingerprint for conflict detection when updatedAt ties. */
export function jobSyncFingerprint(job: Job): string {
  return JSON.stringify(job);
}

export function jobPayloadsEqual(a: Job, b: Job): boolean {
  return jobSyncFingerprint(a) === jobSyncFingerprint(b);
}
