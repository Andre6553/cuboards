import { DEFAULT_CUT_HOUSE_CHARGES, DEFAULT_QUOTE_TERMS, DEFAULT_SETTINGS } from './constants';
import { mergeIntoMaterialCatalog, saveMaterialCatalog } from './materialCatalog';
import type { Job, JobSettings } from '../types';
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
> & { savedAt: string };

function normalizeSettingsForSave(settings: JobSettings): JobSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    cutHouseCharges: {
      ...DEFAULT_CUT_HOUSE_CHARGES,
      ...settings.cutHouseCharges,
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

export function savePriceListFromJob(job: Job): PriceList {
  saveMaterialCatalog(job.materials, job.edgingMaterials);
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
    savedAt: new Date().toISOString(),
  });
  requireUserDataScope();
  localStorage.setItem(userStorageKeys.priceList(), JSON.stringify(list));
  return list;
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

  const settings = normalizeSettingsFromPriceList(list.settings);
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
  };
}
