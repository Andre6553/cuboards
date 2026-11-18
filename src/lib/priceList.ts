import { DEFAULT_CUT_HOUSE_CHARGES, DEFAULT_QUOTE_TERMS, DEFAULT_SETTINGS } from './constants';
import { omitJobMaterialDefaultsFromSettings } from './jobMaterialDefaults';
import {
  mergeEdgingAddOnly,
  mergeIntoMaterialCatalog,
  mergeMaterialsAddOnly,
  unionMaterialsFromJobs,
  upsertMaterialCatalogFromJob,
} from './materialCatalog';
import type { Job, JobSettings } from '../types';
import { normalizeInstallerDetails } from './installerDetails';
import { requireUserDataScope, userStorageKeys } from './userDataScope';

/**
 * Account-wide default pricing saved via “My default prices”.
 * Includes job settings (sheet size, foot price, cut-house, VAT, …), boards, edging,
 * masonite, PVC kickplate strip, install rates, quote terms, and saved Gelmar/hardware overrides.
 * Use **Refresh Gelmar prices** on a job to refresh trade hardware without re-saving defaults.
 */
export type PriceList = Pick<
  Job,
  | 'settings'
  | 'materials'
  | 'edgingMaterials'
  | 'masonite'
  | 'plasticKickplate'
  | 'runnerPrices'
  | 'hingePrices'
  | 'screwPrices'
  | 'connectingFittingPrices'
  | 'installRates'
  | 'hardwarePricing'
  | 'quoteTerms'
  | 'installer'
> & { savedAt: string };

function normalizeSettingsForSave(settings: JobSettings): JobSettings {
  // Job material defaults stay on the job only — never in account price list / Save defaults.
  const withoutJobMats = omitJobMaterialDefaultsFromSettings(settings);
  return {
    ...DEFAULT_SETTINGS,
    ...withoutJobMats,
    cutHouseCharges: {
      ...DEFAULT_CUT_HOUSE_CHARGES,
      ...withoutJobMats.cutHouseCharges,
    },
  };
}

export function normalizeSettingsFromPriceList(settings: JobSettings): JobSettings {
  return normalizeSettingsForSave(settings);
}

export function loadPriceList(): PriceList | null {
  try {
    requireUserDataScope();
    const raw = localStorage.getItem(userStorageKeys.priceList());
    return raw ? (JSON.parse(raw) as PriceList) : null;
  } catch {
    return null;
  }
}

function writePriceListFromJob(job: Job): PriceList {
  const list: PriceList = structuredClone({
    settings: normalizeSettingsForSave(job.settings),
    materials: job.materials,
    edgingMaterials: job.edgingMaterials,
    masonite: job.masonite,
    plasticKickplate: job.plasticKickplate,
    runnerPrices: job.runnerPrices,
    hingePrices: job.hingePrices,
    screwPrices: job.screwPrices,
    connectingFittingPrices: job.connectingFittingPrices,
    installRates: job.installRates,
    hardwarePricing: job.hardwarePricing,
    quoteTerms: { ...DEFAULT_QUOTE_TERMS, ...job.quoteTerms },
    installer: normalizeInstallerDetails(job.installer),
    savedAt: new Date().toISOString(),
  });
  requireUserDataScope();
  localStorage.setItem(userStorageKeys.priceList(), JSON.stringify(list));
  return list;
}

/**
 * Save account defaults from a job without wiping other board types from the catalog.
 * Prefer {@link saveDefaultsAcrossJobs} when broadcasting to every job.
 */
export function savePriceListFromJob(job: Job, allJobs: Job[] = [job]): PriceList {
  upsertMaterialCatalogFromJob(job.materials, job.edgingMaterials, allJobs);
  return writePriceListFromJob(job);
}

/**
 * Enrich the saving job with any boards/edging from catalog + other jobs,
 * upsert the catalog (never delete), write price_list, and apply defaults to every job.
 */
export function saveDefaultsAcrossJobs(
  jobs: Job[],
  sourceJob: Job,
): { priceList: PriceList; jobs: Job[]; currentJob: Job } {
  const { materials: unionMats, edgingMaterials: unionEdge } = unionMaterialsFromJobs(jobs);
  const enriched: Job = {
    ...sourceJob,
    materials: mergeMaterialsAddOnly(sourceJob.materials ?? [], unionMats),
    edgingMaterials: mergeEdgingAddOnly(sourceJob.edgingMaterials ?? [], unionEdge),
  };

  upsertMaterialCatalogFromJob(enriched.materials, enriched.edgingMaterials, jobs);
  const priceList = writePriceListFromJob(enriched);

  const now = new Date().toISOString();
  const nextJobs = jobs.map((j) => {
    const applied = applyPriceListToJob(j, priceList);
    return { ...applied, updatedAt: now };
  });

  const currentJob = nextJobs.find((j) => j.id === enriched.id) ?? {
    ...applyPriceListToJob(enriched, priceList),
    updatedAt: now,
  };

  return { priceList, jobs: nextJobs, currentJob };
}

/** Apply saved defaults onto a job. Units/client are unchanged; boards merge by id. */
export function applyPriceListToJob(job: Job, list: PriceList): Job {
  const mergeById = <T extends { id: string }>(current: T[], incoming: T[]): T[] => {
    const byId = new Map(incoming.map((x) => [x.id, x]));
    const merged = current.map((x) => (byId.has(x.id) ? { ...x, ...byId.get(x.id)! } : x));
    const added = incoming.filter((x) => !current.some((c) => c.id === x.id));
    return [...merged, ...added.map((x) => ({ ...x }))];
  };

  const materials = mergeById(job.materials, list.materials);
  const edgingMaterials = mergeById(job.edgingMaterials, list.edgingMaterials);
  mergeIntoMaterialCatalog(materials, edgingMaterials);

  const fromList = normalizeSettingsFromPriceList(list.settings);
  // Keep this job's material defaults — they are never in the account price list.
  const settings: JobSettings = {
    ...fromList,
    defaultVisibleSideMaterialId: job.settings.defaultVisibleSideMaterialId,
    defaultCarcassMaterialId: job.settings.defaultCarcassMaterialId,
    defaultCarcassEdgingMaterialId: job.settings.defaultCarcassEdgingMaterialId,
    defaultDoorMaterialId: job.settings.defaultDoorMaterialId,
    defaultDoorEdgingMaterialId: job.settings.defaultDoorEdgingMaterialId,
    defaultDrawerFrontMaterialId: job.settings.defaultDrawerFrontMaterialId,
    defaultDrawerFrontEdgingMaterialId: job.settings.defaultDrawerFrontEdgingMaterialId,
  };
  const quoteTerms = list.quoteTerms
    ? { ...DEFAULT_QUOTE_TERMS, ...list.quoteTerms }
    : { ...DEFAULT_QUOTE_TERMS, ...job.quoteTerms };

  return {
    ...job,
    settings,
    materials,
    edgingMaterials,
    masonite: { ...list.masonite },
    plasticKickplate: { ...list.plasticKickplate },
    runnerPrices: { ...job.runnerPrices, ...list.runnerPrices },
    hingePrices: { ...job.hingePrices, ...list.hingePrices },
    screwPrices: { ...job.screwPrices, ...list.screwPrices },
    connectingFittingPrices: { ...job.connectingFittingPrices, ...list.connectingFittingPrices },
    installRates: { ...list.installRates },
    hardwarePricing: list.hardwarePricing ? structuredClone(list.hardwarePricing) : job.hardwarePricing,
    quoteTerms,
    installer: normalizeInstallerDetails(list.installer ?? job.installer),
  };
}
