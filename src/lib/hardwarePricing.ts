import type { CustomHardwareItem, HardwarePricing, Job } from '../types';
import type { HingeCatalogEntry } from './hingeCatalog';
import {
  getHingeById,
  getHingeGroups,
  HINGE_CATALOG,
} from './hingeCatalog';
import type { RunnerCatalogEntry } from './runnerCatalog';
import {
  getRunnerById,
  getRunnerGroups,
  RUNNER_CATALOG,
} from './runnerCatalog';

export const DEFAULT_HARDWARE_PRICING: HardwarePricing = {
  useGelmarCatalog: {
    runners: true,
    hinges: true,
    screws: true,
    connectingFittings: true,
  },
  customCatalog: {
    runners: [],
    hinges: [],
    screws: [],
    connectingFittings: [],
  },
};

export function resolveHardwarePricing(job: Job): HardwarePricing {
  const hp = job.hardwarePricing;
  if (!hp) {
    return {
      useGelmarCatalog: { ...DEFAULT_HARDWARE_PRICING.useGelmarCatalog },
      customCatalog: {
        runners: [],
        hinges: [],
        screws: [],
        connectingFittings: [],
      },
    };
  }
  return {
    useGelmarCatalog: { ...DEFAULT_HARDWARE_PRICING.useGelmarCatalog, ...hp.useGelmarCatalog },
    customCatalog: {
      runners: hp.customCatalog?.runners ?? [],
      hinges: hp.customCatalog?.hinges ?? [],
      screws: hp.customCatalog?.screws ?? [],
      connectingFittings: hp.customCatalog?.connectingFittings ?? [],
    },
  };
}

export function usesGelmarCatalog(job: Job, category: keyof HardwarePricing['useGelmarCatalog']): boolean {
  return resolveHardwarePricing(job).useGelmarCatalog[category] !== false;
}

export function newCustomHardwareItem(partial?: Partial<CustomHardwareItem>): CustomHardwareItem {
  return {
    id: `custom-${crypto.randomUUID().slice(0, 8)}`,
    description: '',
    unitPrice: 0,
    priceUnit: 'each',
    quoteQty: 0,
    ...partial,
  };
}

function customRunnerEntry(item: CustomHardwareItem): RunnerCatalogEntry {
  return {
    id: item.id,
    name: item.description || 'Runner',
    shortName: item.description || 'Runner',
    source: 'brand',
    category: 'custom',
    categoryLabel: 'Your products',
    sideClearance: 13,
    depthDeduction: 25,
    runnerLengthOffset: 26,
    defaultPrice: item.unitPrice,
  };
}

function customHingeEntry(item: CustomHardwareItem): HingeCatalogEntry {
  return {
    id: item.id,
    name: item.description || 'Hinge',
    shortName: item.description || 'Hinge',
    category: 'custom',
    categoryLabel: 'Your products',
    overlay: 'other',
    softClose: false,
    pushOpen: false,
    defaultPrice: item.unitPrice,
  };
}

export function getRunnerCatalogForJob(job: Job): RunnerCatalogEntry[] {
  if (usesGelmarCatalog(job, 'runners')) return RUNNER_CATALOG;
  return resolveHardwarePricing(job).customCatalog.runners.map(customRunnerEntry);
}

export function getRunnerByIdForJob(job: Job, id?: string): RunnerCatalogEntry | undefined {
  if (!id) return undefined;
  if (usesGelmarCatalog(job, 'runners')) return getRunnerById(id);
  const item = resolveHardwarePricing(job).customCatalog.runners.find((x) => x.id === id);
  return item ? customRunnerEntry(item) : undefined;
}

export function getRunnerGroupsForJob(job: Job): { category: string; label: string; runners: RunnerCatalogEntry[] }[] {
  if (usesGelmarCatalog(job, 'runners')) return getRunnerGroups();
  const catalog = getRunnerCatalogForJob(job);
  return catalog.length
    ? [{ category: 'custom', label: 'Your runner products', runners: catalog }]
    : [];
}

export function getHingeCatalogForJob(job: Job): HingeCatalogEntry[] {
  if (usesGelmarCatalog(job, 'hinges')) return HINGE_CATALOG;
  return resolveHardwarePricing(job).customCatalog.hinges.map(customHingeEntry);
}

export function getHingeByIdForJob(job: Job, id?: string): HingeCatalogEntry | undefined {
  if (!id) return undefined;
  if (usesGelmarCatalog(job, 'hinges')) return getHingeById(id);
  const item = resolveHardwarePricing(job).customCatalog.hinges.find((x) => x.id === id);
  return item ? customHingeEntry(item) : undefined;
}

export function getHingeGroupsForJob(job: Job): { category: string; label: string; hinges: HingeCatalogEntry[] }[] {
  if (usesGelmarCatalog(job, 'hinges')) return getHingeGroups();
  const catalog = getHingeCatalogForJob(job);
  return catalog.length
    ? [{ category: 'custom', label: 'Your hinge products', hinges: catalog }]
    : [];
}

export function resolveRunnerUnitPrice(job: Job, presetId: string): number {
  if (usesGelmarCatalog(job, 'runners')) {
    const entry = getRunnerById(presetId);
    return job.runnerPrices[presetId] ?? entry?.defaultPrice ?? job.runnerPrices.custom ?? 0;
  }
  const item = resolveHardwarePricing(job).customCatalog.runners.find((x) => x.id === presetId);
  return item?.unitPrice ?? 0;
}

export function resolveHingeUnitPrice(job: Job, presetId: string): number {
  if (usesGelmarCatalog(job, 'hinges')) {
    const entry = getHingeById(presetId);
    return job.hingePrices[presetId] ?? entry?.defaultPrice ?? job.hingePrices.custom ?? 0;
  }
  const item = resolveHardwarePricing(job).customCatalog.hinges.find((x) => x.id === presetId);
  return item?.unitPrice ?? 0;
}

/** Runner clearances using Gelmar/brand or custom product catalog. */
export function getRunnerClearancesForJob(
  job: Job,
  runner: {
    type: 'preset' | 'custom';
    presetId?: string;
    customSideClearance?: number;
    customDepthDeduction?: number;
  },
) {
  if (runner.type === 'custom') {
    return {
      sideClearance: runner.customSideClearance ?? 13,
      depthDeduction: runner.customDepthDeduction ?? 25,
      runnerLengthOffset: 26,
    };
  }
  const entry = getRunnerByIdForJob(job, runner.presetId);
  if (!entry) {
    return { sideClearance: 13, depthDeduction: 25, runnerLengthOffset: 26 };
  }
  return {
    sideClearance: entry.sideClearance,
    depthDeduction: entry.depthDeduction,
    runnerLengthOffset: entry.runnerLengthOffset,
    fixedLengthMm: entry.lengthMm,
    entry,
  };
}

export function calcCustomPackLines(
  job: Job,
  category: 'screws' | 'connectingFittings',
): import('../types').ScrewLine[] {
  const items = resolveHardwarePricing(job).customCatalog[category];
  const lines: import('../types').ScrewLine[] = [];
  for (const item of items) {
    const packs = Math.max(0, item.quoteQty ?? 0);
    if (packs <= 0) continue;
    const packSize = item.packSize ?? 1;
    lines.push({
      screwId: item.id,
      name: item.description || 'Product',
      sku: '—',
      totalScrews: packs * packSize,
      packSize,
      packsNeeded: packs,
      packPrice: item.unitPrice,
      subtotal: packs * item.unitPrice,
      usageDetail: 'Custom product qty',
    });
  }
  return lines;
}
