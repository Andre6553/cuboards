import type { Job } from '../types';

const PRICE_LIST_KEY = 'cuboards_price_list';

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
> & { savedAt: string };

export function loadPriceList(): PriceList | null {
  try {
    const raw = localStorage.getItem(PRICE_LIST_KEY);
    return raw ? (JSON.parse(raw) as PriceList) : null;
  } catch {
    return null;
  }
}

export function savePriceListFromJob(job: Job): PriceList {
  const list: PriceList = structuredClone({
    settings: job.settings,
    materials: job.materials,
    edgingMaterials: job.edgingMaterials,
    masonite: job.masonite,
    plasticKickplate: job.plasticKickplate,
    runnerPrices: job.runnerPrices,
    hingePrices: job.hingePrices,
    screwPrices: job.screwPrices,
    connectingFittingPrices: job.connectingFittingPrices,
    installRates: job.installRates,
    savedAt: new Date().toISOString(),
  });
  localStorage.setItem(PRICE_LIST_KEY, JSON.stringify(list));
  return list;
}

/**
 * Prices only: board/edging prices merge by id (units reference those ids, so nothing is removed),
 * job settings stay as they are so existing cut sizes don't change.
 */
export function applyPriceListToJob(job: Job, list: PriceList): Job {
  const mergeById = <T extends { id: string }>(current: T[], incoming: T[]): T[] => {
    const byId = new Map(incoming.map((x) => [x.id, x]));
    const merged = current.map((x) => (byId.has(x.id) ? { ...x, ...byId.get(x.id)! } : x));
    const added = incoming.filter((x) => !current.some((c) => c.id === x.id));
    return [...merged, ...added.map((x) => ({ ...x }))];
  };

  return {
    ...job,
    materials: mergeById(job.materials, list.materials),
    edgingMaterials: mergeById(job.edgingMaterials, list.edgingMaterials),
    masonite: { ...list.masonite },
    plasticKickplate: { ...list.plasticKickplate },
    runnerPrices: { ...job.runnerPrices, ...list.runnerPrices },
    hingePrices: { ...job.hingePrices, ...list.hingePrices },
    screwPrices: { ...job.screwPrices, ...list.screwPrices },
    connectingFittingPrices: { ...job.connectingFittingPrices, ...list.connectingFittingPrices },
    installRates: { ...list.installRates },
  };
}
