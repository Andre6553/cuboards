import type { Job } from '../types';
import { migrateJob } from './storage';
import { getSupabase } from './supabaseClient';

type JobRow = { id: string; data: Job; updated_at: string };

function rowToJob(row: JobRow): Job {
  const raw = row.data as Job;
  return migrateJob({ ...raw, id: row.id, updatedAt: raw.updatedAt ?? row.updated_at });
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

export type CloudUpsertResult = 'ok' | 'conflict';
export type CloudDeleteResult = 'ok' | 'conflict';

/** Upsert only when local job is not older than the cloud row (by updated_at). */
export async function upsertCloudJobIfNotStale(userId: string, job: Job): Promise<CloudUpsertResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('cuboards_jobs')
    .select('updated_at')
    .eq('user_id', userId)
    .eq('id', job.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const remoteUpdated = (data as { updated_at: string } | null)?.updated_at;
  if (remoteUpdated && remoteUpdated.localeCompare(job.updatedAt) > 0) {
    return 'conflict';
  }
  await upsertCloudJobs(userId, [job]);
  return 'ok';
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
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('cuboards_jobs')
    .select('updated_at')
    .eq('user_id', userId)
    .eq('id', jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const remoteUpdated = (data as { updated_at: string } | null)?.updated_at;
  if (remoteUpdated && remoteUpdated.localeCompare(localUpdatedAt) > 0) {
    return 'conflict';
  }
  await deleteCloudJob(userId, jobId);
  return 'ok';
}
