import type {
  ConnectingFittingPrices,
  HingePrices,
  Job,
  RunnerPrices,
  ScrewPrices,
} from '../types';
import { scheduleCloudPrefsPush } from './cloudPrefsPush';
import { requireUserDataScope, userStorageKeys } from './userDataScope';

export type GelmarPriceCategory = 'runners' | 'hinges' | 'screws' | 'connectingFittings';

export interface GelmarPriceSnapshot {
  runnerPrices: RunnerPrices;
  hingePrices: HingePrices;
  screwPrices: ScrewPrices;
  connectingFittingPrices: ConnectingFittingPrices;
  savedAt: string;
  scrapedAt?: Partial<Record<GelmarPriceCategory, string>>;
}

function emptySnapshot(): GelmarPriceSnapshot {
  return {
    runnerPrices: {},
    hingePrices: {},
    screwPrices: {},
    connectingFittingPrices: {},
    savedAt: '',
  };
}

export function loadGelmarPriceSnapshot(): GelmarPriceSnapshot | null {
  try {
    requireUserDataScope();
    const raw = localStorage.getItem(userStorageKeys.gelmarPrices());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GelmarPriceSnapshot;
    if (!parsed.savedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveGelmarPriceSnapshot(snapshot: GelmarPriceSnapshot): void {
  requireUserDataScope();
  localStorage.setItem(userStorageKeys.gelmarPrices(), JSON.stringify(snapshot));
}

export function patchGelmarCategoryPrices(
  category: GelmarPriceCategory,
  prices: Record<string, number>,
  scrapedAt?: string | null,
): void {
  const base = loadGelmarPriceSnapshot() ?? emptySnapshot();
  const now = new Date().toISOString();
  const next: GelmarPriceSnapshot = {
    ...base,
    savedAt: now,
    scrapedAt: { ...base.scrapedAt, ...(scrapedAt ? { [category]: scrapedAt } : {}) },
  };
  if (category === 'runners') next.runnerPrices = { ...base.runnerPrices, ...prices };
  if (category === 'hinges') next.hingePrices = { ...base.hingePrices, ...prices };
  if (category === 'screws') next.screwPrices = { ...base.screwPrices, ...prices };
  if (category === 'connectingFittings') {
    next.connectingFittingPrices = { ...base.connectingFittingPrices, ...prices };
  }
  saveGelmarPriceSnapshot(next);
  scheduleCloudPrefsPush();
}

export function applyGelmarSnapshotToJobPricing(job: Job): Job {
  const snap = loadGelmarPriceSnapshot();
  if (!snap?.savedAt) return job;
  return {
    ...job,
    runnerPrices: { ...job.runnerPrices, ...snap.runnerPrices },
    hingePrices: { ...job.hingePrices, ...snap.hingePrices },
    screwPrices: { ...job.screwPrices, ...snap.screwPrices },
    connectingFittingPrices: { ...job.connectingFittingPrices, ...snap.connectingFittingPrices },
  };
}

export function mergeGelmarSnapshots(local: GelmarPriceSnapshot | null, remote: GelmarPriceSnapshot | null): GelmarPriceSnapshot | null {
  if (!remote?.savedAt) return local;
  if (!local?.savedAt) return remote;
  if (remote.savedAt.localeCompare(local.savedAt) >= 0) return remote;
  return local;
}
