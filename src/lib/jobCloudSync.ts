import type { Job } from '../types';
import {
  registerCloudPrefsPushImpl,
  scheduleCloudPrefsPush,
  setCloudPrefsPushContext,
} from './cloudPrefsPush';
import {
  type GelmarPriceSnapshot,
  loadGelmarPriceSnapshot,
  mergeGelmarSnapshots,
  saveGelmarPriceSnapshot,
} from './gelmarPriceSnapshot';
import {
  applyCommunityMaterialsPrefsFromCloud,
  loadCommunityMaterialsPrefs,
  publishCommunityMaterialsFromCatalog,
} from './communityMaterials';
import { loadMaterialCatalog, saveMaterialCatalog, type BoardCatalog } from './materialCatalog';
import {
  adoptLegacyUnitPresetsIfEmpty,
  loadPresetsBundle,
  mergePresetBundles,
  type UnitPresetsBundle,
  writePresetsBundle,
} from './presets';
import { loadPriceList, type PriceList } from './priceList';
import { recordCloudSync } from './backupReminder';
import { loadJobs, migrateJob } from './storage';
import { getSupabase } from './supabaseClient';
import { adoptLegacyDeviceStorageIfEmpty, requireUserDataScope, userStorageKeys } from './userDataScope';

let cloudSaveListener: (() => void) | null = null;

export function setCloudSaveListener(fn: (() => void) | null): void {
  cloudSaveListener = fn;
}

export function notifyCloudSaved(): void {
  recordCloudSync();
  cloudSaveListener?.();
}

type JobRow = { id: string; data: Job; updated_at: string };
type PrefsRow = {
  board_catalog: BoardCatalog | null;
  price_list: PriceList | null;
  unit_presets: UnitPresetsBundle | null;
  gelmar_prices: GelmarPriceSnapshot | null;
  accept_community_materials?: boolean | null;
  community_materials_seen_at?: string | null;
  updated_at: string;
};

export function mergeJobLists(local: Job[], remote: Job[]): Job[] {
  const map = new Map<string, Job>();
  for (const j of remote) map.set(j.id, j);
  for (const j of local) {
    const existing = map.get(j.id);
    if (!existing || j.updatedAt.localeCompare(existing.updatedAt) > 0) {
      map.set(j.id, j);
    }
  }
  return [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function rowToJob(row: JobRow): Job {
  const raw = row.data as Job;
  const job = migrateJob({ ...raw, id: row.id, updatedAt: raw.updatedAt ?? row.updated_at });
  return job;
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

export async function deleteCloudJob(userId: string, jobId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('cuboards_jobs').delete().eq('user_id', userId).eq('id', jobId);
  if (error) throw new Error(error.message);
}

export async function syncJobsWithCloud(userId: string): Promise<Job[]> {
  requireUserDataScope();
  adoptLegacyUnitPresetsIfEmpty();
  const remote = await fetchCloudJobs(userId);
  let local = loadJobs();
  if (local.length === 0 && remote.length === 0) {
    adoptLegacyDeviceStorageIfEmpty();
    local = loadJobs();
  }
  const merged = mergeJobLists(local, remote);
  await upsertCloudJobs(userId, merged);
  return merged;
}

/** Merge jobs + prefs with Supabase (pull then push). */
export async function syncAccountWithCloud(userId: string): Promise<Job[]> {
  const merged = await syncJobsWithCloud(userId);
  await pullUserPrefs(userId);
  await pushUserPrefsFromLocal(userId);
  return merged;
}

function applyPrefsFromCloud(row: PrefsRow): void {
  const catalog = row.board_catalog;
  const priceList = row.price_list;
  const localCatalog = loadMaterialCatalog();
  const localPrice = loadPriceList();

  if (catalog?.materials?.length) {
    const useCloud =
      !localCatalog ||
      !localCatalog.savedAt ||
      catalog.savedAt.localeCompare(localCatalog.savedAt) >= 0;
    if (useCloud) {
      saveMaterialCatalog(catalog.materials, catalog.edgingMaterials);
    }
  }

  if (priceList?.settings) {
    const useCloud =
      !localPrice || !localPrice.savedAt || priceList.savedAt.localeCompare(localPrice.savedAt) >= 0;
    if (useCloud) {
      requireUserDataScope();
      localStorage.setItem(userStorageKeys.priceList(), JSON.stringify(priceList));
    }
  }

  if (row.unit_presets?.presets) {
    const merged = mergePresetBundles(loadPresetsBundle(), row.unit_presets);
    writePresetsBundle(merged);
  }

  const mergedGelmar = mergeGelmarSnapshots(loadGelmarPriceSnapshot(), row.gelmar_prices);
  if (mergedGelmar?.savedAt) {
    saveGelmarPriceSnapshot(mergedGelmar);
  }

  applyCommunityMaterialsPrefsFromCloud(row.accept_community_materials);
}

export async function pullUserPrefs(userId: string): Promise<void> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('cuboards_user_prefs')
    .select(
      'board_catalog, price_list, unit_presets, gelmar_prices, accept_community_materials, community_materials_seen_at, updated_at',
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;
  applyPrefsFromCloud(data as PrefsRow);
}

export async function pushUserPrefsFromLocal(userId: string): Promise<void> {
  const supabase = getSupabase();
  const board_catalog = loadMaterialCatalog();
  const price_list = loadPriceList();
  const unit_presets = loadPresetsBundle();
  const gelmar_prices = loadGelmarPriceSnapshot();
  const communityPrefs = loadCommunityMaterialsPrefs();
  const { error } = await supabase.from('cuboards_user_prefs').upsert({
    user_id: userId,
    board_catalog,
    price_list,
    unit_presets: unit_presets.presets.length ? unit_presets : null,
    gelmar_prices: gelmar_prices?.savedAt ? gelmar_prices : null,
    accept_community_materials: communityPrefs.acceptUpdates,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  await publishCommunityMaterialsFromCatalog(board_catalog);
}

export function setCloudSyncUserId(userId: string | null): void {
  setCloudPrefsPushContext(userId, notifyCloudSaved);
}

export { scheduleCloudPrefsPush as schedulePushUserPrefs };

registerCloudPrefsPushImpl(async (userId) => {
  await pushUserPrefsFromLocal(userId);
});

let jobsPushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingJobsPush: { userId: string; jobs: Job[] } | null = null;

export function schedulePushJobs(userId: string, jobs: Job[]): void {
  pendingJobsPush = { userId, jobs };
  if (jobsPushTimer) clearTimeout(jobsPushTimer);
  jobsPushTimer = setTimeout(() => {
    const batch = pendingJobsPush;
    pendingJobsPush = null;
    if (!batch) return;
    void upsertCloudJobs(batch.userId, batch.jobs)
      .then(() => notifyCloudSaved())
      .catch((e) => console.error('pushJobs', e));
  }, 600);
}
