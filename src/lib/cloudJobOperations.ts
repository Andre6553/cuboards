import type { Job } from '../types';
import { jobPayloadsEqual } from './jobSyncFingerprint';
import { migrateJob } from './storage';
import { getSupabase } from './supabaseClient';

type JobRow = { id: string; data: Job; updated_at: string };

function rowToJob(row: JobRow): Job {
  const raw = row.data as Job;
  return migrateJob({ ...raw, id: row.id, updatedAt: raw.updatedAt ?? row.updated_at });
}

export type CloudUpsertResult = 'ok' | 'conflict';
export type CloudDeleteResult = 'ok' | 'conflict';

/** Timestamp-only rule (legacy); prefer shouldAcceptJobUpsert when payload is available. */
export function shouldAcceptLocalWrite(remoteUpdatedAt: string | null, localUpdatedAt: string): boolean {
  if (!remoteUpdatedAt) return true;
  return remoteUpdatedAt.localeCompare(localUpdatedAt) <= 0;
}

/** Full upsert conflict rule: equal updatedAt requires identical job payload. */
export function shouldAcceptJobUpsert(
  remoteUpdatedAt: string | null,
  remoteJob: Job | null,
  localJob: Job,
): boolean {
  if (!remoteUpdatedAt) return true;
  const cmp = remoteUpdatedAt.localeCompare(localJob.updatedAt);
  if (cmp > 0) return false;
  if (cmp < 0) return true;
  if (!remoteJob) return true;
  return jobPayloadsEqual(remoteJob, localJob);
}

/** Mirrors post-lock upsert write result when ON CONFLICT DO UPDATE may no-op (regression tests). */
export function resolveUpsertAfterConditionalWrite(
  remoteUpdatedAt: string | null,
  localUpdatedAt: string,
  returningUpdatedAt: string | null,
  remoteJob: Job | null = null,
  localJob: Job | null = null,
): CloudUpsertResult {
  if (localJob && !shouldAcceptJobUpsert(remoteUpdatedAt, remoteJob, localJob)) {
    return 'conflict';
  }
  if (remoteUpdatedAt && remoteUpdatedAt.localeCompare(localUpdatedAt) > 0) {
    return 'conflict';
  }
  if (returningUpdatedAt) return 'ok';
  if (!remoteUpdatedAt) return 'conflict';
  if (remoteUpdatedAt.localeCompare(localUpdatedAt) < 0) return 'ok';
  if (remoteJob && localJob && !jobPayloadsEqual(remoteJob, localJob)) return 'conflict';
  return 'ok';
}

export type CloudSyncTestHooks = {
  upsertCloudJobIfNotStale?: (userId: string, job: Job) => Promise<CloudUpsertResult>;
  deleteCloudJobIfNotStale?: (
    userId: string,
    jobId: string,
    localUpdatedAt: string,
  ) => Promise<CloudDeleteResult>;
};

let cloudSyncTestHooks: CloudSyncTestHooks | null = null;

/** Browser smoke / manual QA — bypasses Supabase when set. */
export function setCloudSyncTestHooks(hooks: CloudSyncTestHooks | null): void {
  cloudSyncTestHooks = hooks;
}

export async function fetchCloudJobs(userId: string): Promise<Job[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('cuboards_jobs')
    .select('id, data, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as JobRow[] | null)?.map(rowToJob) ?? [];
}

export async function fetchCloudJobById(userId: string, jobId: string): Promise<Job | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('cuboards_jobs')
    .select('id, data, updated_at')
    .eq('user_id', userId)
    .eq('id', jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToJob(data as JobRow);
}

export async function upsertCloudJobs(userId: string, jobs: Job[]): Promise<void> {
  if (jobs.length === 0) return;
  const supabase = getSupabase();
  const rows = jobs.map((j) => ({
    id: j.id,
    user_id: userId,
    data: j,
    updated_at: j.updatedAt,
  }));
  const { error } = await supabase.from('cuboards_jobs').upsert(rows, { onConflict: 'user_id,id' });
  if (error) throw new Error(error.message);
}

function isMissingRpcError(error: { message?: string; code?: string }): boolean {
  const msg = (error.message ?? '').toLowerCase();
  return (
    error.code === 'PGRST202' ||
    msg.includes('could not find the function') ||
    msg.includes('schema cache')
  );
}

async function upsertCloudJobViaRpc(_userId: string, job: Job): Promise<CloudUpsertResult | 'missing'> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('cuboards_upsert_job_if_not_stale', {
    p_job_id: job.id,
    p_data: job,
    p_updated_at: job.updatedAt,
  });
  if (error) {
    if (isMissingRpcError(error)) return 'missing';
    throw new Error(error.message);
  }
  return data === 'conflict' ? 'conflict' : 'ok';
}

async function upsertCloudJobViaSelect(userId: string, job: Job): Promise<CloudUpsertResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('cuboards_jobs')
    .select('id, data, updated_at')
    .eq('user_id', userId)
    .eq('id', job.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as JobRow | null;
  const remoteUpdated = row?.updated_at ?? null;
  const remoteJob = row ? rowToJob(row) : null;
  if (!shouldAcceptJobUpsert(remoteUpdated, remoteJob, job)) {
    return 'conflict';
  }
  if (remoteJob && jobPayloadsEqual(remoteJob, job)) {
    return 'ok';
  }
  await upsertCloudJobs(userId, [job]);
  return 'ok';
}

/** Upsert only when local job is not older than the cloud row (atomic RPC when deployed). */
export async function upsertCloudJobIfNotStale(userId: string, job: Job): Promise<CloudUpsertResult> {
  if (cloudSyncTestHooks?.upsertCloudJobIfNotStale) {
    return cloudSyncTestHooks.upsertCloudJobIfNotStale(userId, job);
  }
  const viaRpc = await upsertCloudJobViaRpc(userId, job);
  if (viaRpc !== 'missing') return viaRpc;
  return upsertCloudJobViaSelect(userId, job);
}

async function deleteCloudJobViaRpc(
  _userId: string,
  jobId: string,
  localUpdatedAt: string,
): Promise<CloudDeleteResult | 'missing'> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('cuboards_delete_job_if_not_stale', {
    p_job_id: jobId,
    p_updated_at: localUpdatedAt,
  });
  if (error) {
    if (isMissingRpcError(error)) return 'missing';
    throw new Error(error.message);
  }
  return data === 'conflict' ? 'conflict' : 'ok';
}

export async function deleteCloudJob(userId: string, jobId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('cuboards_jobs').delete().eq('user_id', userId).eq('id', jobId);
  if (error) throw new Error(error.message);
}

/** Delete only when the cloud row is not newer than the job that was deleted locally. */
export async function deleteCloudJobIfNotStale(
  userId: string,
  jobId: string,
  localUpdatedAt: string,
): Promise<CloudDeleteResult> {
  if (cloudSyncTestHooks?.deleteCloudJobIfNotStale) {
    return cloudSyncTestHooks.deleteCloudJobIfNotStale(userId, jobId, localUpdatedAt);
  }
  const viaRpc = await deleteCloudJobViaRpc(userId, jobId, localUpdatedAt);
  if (viaRpc !== 'missing') return viaRpc;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('cuboards_jobs')
    .select('updated_at')
    .eq('user_id', userId)
    .eq('id', jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const remoteUpdated = (data as { updated_at: string } | null)?.updated_at ?? null;
  if (remoteUpdated && !shouldAcceptLocalWrite(remoteUpdated, localUpdatedAt)) {
    return 'conflict';
  }
  await deleteCloudJob(userId, jobId);
  return 'ok';
}
