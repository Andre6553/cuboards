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
import {
  enqueueCloudJobDelete,
  enqueueCloudJobUpsert,
  getCloudJobQueueSnapshot,
} from './cloudJobQueue';
import { fetchCloudJobs } from './cloudJobOperations';
import { loadJobs } from './storage';
import { getSupabase } from './supabaseClient';
import { adoptLegacyDeviceStorageIfEmpty, requireUserDataScope, userStorageKeys } from './userDataScope';

export {
  deleteCloudJob,
  deleteCloudJobIfNotStale,
  fetchCloudJobById,
  upsertCloudJobIfNotStale,
  type CloudDeleteResult,
  type CloudUpsertResult,
} from './cloudJobOperations';

let cloudSaveListener: (() => void) | null = null;

export function setCloudSaveListener(fn: (() => void) | null): void {
  cloudSaveListener = fn;
}

export function notifyCloudSaved(): void {
  recordCloudSync();
  cloudSaveListener?.();
}

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

export async function syncJobsWithCloud(userId: string): Promise<Job[]> {
  requireUserDataScope();
  adoptLegacyUnitPresetsIfEmpty();
  const remote = await fetchCloudJobs(userId);
  let local = loadJobs();
  if (local.length === 0 && remote.length === 0) {
    adoptLegacyDeviceStorageIfEmpty();
    local = loadJobs();
  }

  // Honour durable queue ops that have not flushed yet so a pull cannot resurrect
  // deleted jobs, and queued upserts win over older remote copies.
  const pending = await getCloudJobQueueSnapshot(userId);
  const pendingDeletes = new Set(pending.filter((op) => op.kind === 'delete').map((op) => op.jobId));
  const pendingUpserts = new Map<string, Job>();
  for (const op of pending) {
    if (op.kind === 'upsert' && op.jobJson) {
      try {
        pendingUpserts.set(op.jobId, JSON.parse(op.jobJson) as Job);
      } catch {
        /* ignore corrupt queue payload */
      }
    }
  }

  const remoteWithoutDeletes = remote.filter((j) => !pendingDeletes.has(j.id));
  const localWithQueued = local.map((j) => pendingUpserts.get(j.id) ?? j);
  for (const [id, job] of pendingUpserts) {
    if (!localWithQueued.some((j) => j.id === id) && !pendingDeletes.has(id)) {
      localWithQueued.push(job);
    }
  }

  const merged = mergeJobLists(localWithQueued, remoteWithoutDeletes).filter(
    (j) => !pendingDeletes.has(j.id),
  );

  // Push via durable queue (not a one-shot network call) so failures still retry.
  for (const job of merged) {
    await enqueueCloudJobUpsert(userId, job);
  }
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

/**
 * Persist upserts to IndexedDB immediately (debouncing happens inside the queue processor).
 * A refresh mid-save must not lose the queued op.
 */
export function schedulePushJobs(userId: string, jobs: Job[]): void {
  for (const job of jobs) {
    void enqueueCloudJobUpsert(userId, job).catch((e) => console.error('enqueueCloudJobUpsert', e));
  }
}

/** Immediate durable delete (IndexedDB queue + retries). */
export function scheduleDeleteCloudJob(userId: string, job: Job): void {
  void enqueueCloudJobDelete(userId, job).catch((e) => console.error('enqueueCloudJobDelete', e));
}
