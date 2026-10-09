import type { ConnectingFittingPrices, EdgingMaterial, HingePrices, JobSettings, KitchenPlinthConfig, MasoniteConfig, Material, MountType, PlasticKickplateConfig, QuoteTerms, RunnerPrices, ScrewPrices, UnitType } from '../types';
import { CUT_SIZE_MODE_LABELS } from './edgingCutSize';
import { BRAND_RUNNER_PRESETS, getDefaultRunnerPrices } from './runnerCatalog';
import { getDefaultHingePrices } from './hingeCatalog';
import { getDefaultScrewPrices } from './screwCatalog';
import { getDefaultConnectingFittingPrices } from './connectingFittingCatalog';

export { getRunnerClearances, getDefaultRunnerPrices, getRunnerById, getRunnerGroups, GELMAR_RUNNERS, GELMAR_SCRAPED_AT, RUNNER_CATALOG } from './runnerCatalog';
export type { RunnerCatalogEntry } from './runnerCatalog';
export {
  getHingeById,
  getHingeGroups,
  getDefaultHingePrices,
  GELMAR_HINGES,
  GELMAR_HINGES_SCRAPED_AT,
  HINGE_CATALOG,
  DEFAULT_HINGE_PRESET_ID,
} from './hingeCatalog';
export type { HingeCatalogEntry } from './hingeCatalog';
export { getDefaultScrewPrices, getScrewById, GELMAR_SCREWS_SCRAPED_AT, SCREW_CATALOG } from './screwCatalog';
export type { ScrewCatalogEntry } from './screwCatalog';
export { DEFAULT_SCREW_USAGE } from './screwRules';
export {
  getDefaultConnectingFittingPrices,
  getConnectingFittingById,
  GELMAR_CONNECTING_FITTINGS_SCRAPED_AT,
  CONNECTING_FITTING_CATALOG,
} from './connectingFittingCatalog';
export { DEFAULT_CONNECTING_FITTING_USAGE } from './connectingFittingRules';
export { DEFAULT_INSTALL_RATES } from './installRules';

/** @deprecated use BRAND_RUNNER_PRESETS or RUNNER_CATALOG — kept for existing imports */
export const RUNNER_PRESETS = BRAND_RUNNER_PRESETS;

export const EDGING_LABELS: Record<string, string> = {
  '1_long': '1 long edge',
  '2_long': '2 long edges',
  '1_long_1_short': '1 long + 1 short',
  '1_long_2_short': '1 long + 2 short',
  '2_long_2_short': '2 long + 2 short (all edges)',
  none: 'No edging',
};

export const UNIT_TYPE_LABELS = {
  kitchen_base: 'Kitchen base unit',
  wall: 'Wall unit',
  bedroom: 'Bedroom cupboard',
} as const;

export const COUNTERTOP_LABELS = {
  granite: 'Granite / stone top (2 fillers)',
  wooden: 'Wooden / laminate top (3 fillers)',
} as const;

export const BACKING_LABELS = {
  none: 'No back panel',
  masonite: 'Masonite backing',
  melamine: 'Melamine backing (inside carcass)',
} as const;

export const KICKPLATE_TYPE_LABELS = {
  wood: 'Wood / melamine board',
  plastic: 'Plastic strip',
} as const;

export const KICKPLATE_COVERAGE_LABELS = {
  front: 'Front only',
  'front-one-side': 'Front + one side',
  'front-both-sides': 'Front + both sides',
} as const;

export const DEFAULT_PLASTIC_KICKPLATE: PlasticKickplateConfig = {
  name: 'PVC kickplate strip',
  stripHeight: 120,
  stripWidth: 18,
  pricePerMetre: 45,
};

export { CUT_SIZE_MODE_LABELS };

export const DEFAULT_SETTINGS: JobSettings = {
  thickness: 16,
  sheetWidth: 2750,
  sheetHeight: 1830,
  defaultGap: 2,
  defaultFillerWidth: 100,
  defaultKickplateHeight: 120,
  feetPerBaseUnit: 4,
  pricePerFoot: 25,
  cutSizeMode: 'final',
  quoteCurrency: 'ZAR',
  vatRatePercent: 15,
  pricesEnterAsInclVat: false,
  showVatOnQuote: true,
  boardWastagePercent: 0,
  sawKerfMm: 4,
};

export const DEFAULT_QUOTE_TERMS: QuoteTerms = {
  validityDays: 30,
  depositPercent: 50,
  paymentNote: 'Balance on completion via EFT.',
  extraNotes: '',
};

/** Common melamine sheet sizes in South Africa (costing). */
export const SHEET_SIZE_PRESETS: { label: string; width: number; height: number }[] = [
  { label: '2750 × 1830 mm (standard full sheet)', width: 2750, height: 1830 },
  { label: '3650 × 1830 mm (long sheet)', width: 3650, height: 1830 },
  { label: '2750 × 1600 mm', width: 2750, height: 1600 },
  { label: 'Custom', width: 0, height: 0 },
];

export function isKitchenBase(type: UnitType): boolean {
  return type === 'kitchen_base';
}

export const MOUNT_TYPE_LABELS = {
  floor: 'Floor unit',
  wall: 'Wall unit',
} as const;

export function isFloorUnit(unit: { carcass?: { mountType?: MountType } }): boolean {
  return (unit.carcass?.mountType ?? 'floor') === 'floor';
}

export function isWallUnit(unit: { carcass?: { mountType?: MountType } }): boolean {
  return unit.carcass?.mountType === 'wall';
}

export function defaultPlinth(job: { settings: JobSettings; materials: Material[] }, visibleMatId?: string): KitchenPlinthConfig {
  return {
    kickplateType: 'wood',
    kickplateCoverage: 'front',
    kickplateSide: 'left',
    kickplateMaterialId: visibleMatId ?? job.materials[0]?.id ?? 'mat-white',
    kickplateHeight: job.settings.defaultKickplateHeight,
    feetPerUnit: job.settings.feetPerBaseUnit,
    feetRequired: true,
  };
}

export const DEFAULT_EDGING: EdgingMaterial[] = [
  { id: 'edge-white-1', name: 'White PVC edging', thickness: 1, pricePerMetre: 8 },
  { id: 'edge-oak-1', name: 'Oak PVC edging', thickness: 1, pricePerMetre: 15 },
];

export const DEFAULT_MASONITE: MasoniteConfig = {
  name: 'Masonite backing',
  colour: 'Brown',
  thickness: 3,
  pricePerSheet: 120,
  sheetWidth: 2440,
  sheetHeight: 1220,
  sheetPurchaseUnit: 'quarter',
};

export const DEFAULT_RUNNER_PRICES: RunnerPrices = getDefaultRunnerPrices();
export const DEFAULT_HINGE_PRICES: HingePrices = getDefaultHingePrices();
export const DEFAULT_SCREW_PRICES: ScrewPrices = getDefaultScrewPrices();
export const DEFAULT_CONNECTING_FITTING_PRICES: ConnectingFittingPrices = getDefaultConnectingFittingPrices();

export const DEFAULT_MATERIALS: Material[] = [
  {
    id: 'mat-white',
    name: 'White melamine',
    colour: 'White',
    pricePerSheet: 850,
    hasGrain: false,
    edgingMaterialId: 'edge-white-1',
  },
  {
    id: 'mat-oak',
    name: 'Oak melamine',
    colour: 'Oak',
    pricePerSheet: 1200,
    hasGrain: true,
    edgingMaterialId: 'edge-oak-1',
  },
];
