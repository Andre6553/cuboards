import type {
  ConnectingFittingPrices,
  CutHouseChargeSettings,
  EdgingMaterial,
  HingePrices,
  JobSettings,
  KickplateType,
  KitchenPlinthConfig,
  MasoniteConfig,
  Material,
  MountType,
  PlasticKickplateConfig,
  QuoteTerms,
  RunnerPrices,
  ScrewPrices,
  UnitType,
} from '../types';
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
export { DEFAULT_INSTALL_RATES } from './installRules';

/** @deprecated use BRAND_RUNNER_PRESETS or RUNNER_CATALOG — kept for existing imports */
export const RUNNER_PRESETS = BRAND_RUNNER_PRESETS;

export const EDGING_LABELS: Record<string, string> = {
  '1_long': '1 long edge',
  '2_long': '2 long edges',
  '1_short': '1 short edge',
  '2_short': '2 short edges',
  '1_long_1_short': '1 long + 1 short',
  '1_long_2_short': '1 long + 2 short',
  '2_long_1_short': '2 long + 1 short',
  '2_long_2_short': '2 long + 2 short (all edges)',
  none: 'No edging',
};

/** Wood kickplate edging checkboxes (combine long + short; “No edging” clears all). */
export const KICKPLATE_EDGING_CHECKBOXES = [
  { key: 'none' as const, label: 'No edging' },
  { key: 'long1' as const, label: '1 Long' },
  { key: 'long2' as const, label: '2 Long' },
  { key: 'short1' as const, label: '1 short' },
  { key: 'short2' as const, label: '2 short' },
];

export const UNIT_TYPE_LABELS = {
  kitchen_base: 'Kitchen base unit',
  wall: 'Wall unit',
  bedroom: 'Bedroom cupboard',
} as const;

export const COUNTERTOP_LABELS = {
  granite: 'Granite / stone top (2 fillers)',
  wooden: 'Wooden / laminate top (3 top fillers)',
} as const;

export const BACKING_LABELS = {
  none: 'No back panel',
  masonite: 'Masonite backing',
  melamine: 'Melamine backing (inside carcass)',
} as const;

export const KICKPLATE_TYPE_LABELS = {
  wood: 'Wood / melamine board',
  plastic: 'Plastic strip',
  none: 'No kickplate',
} as const;

export function plinthHasKickplate(
  plinth: { kickplateType?: KickplateType } | undefined,
): boolean {
  const t = plinth?.kickplateType ?? 'wood';
  return t === 'wood' || t === 'plastic';
}

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

/** Cut-house quote defaults (0 = off until you enter your cut house’s prices). */
export const DEFAULT_CUT_HOUSE_CHARGES: Required<CutHouseChargeSettings> = {
  melamineCutPricePerSheet: 0,
  hardboardCutPricePerSheet: 0,
  factoryDrillPricePerHole: 0,
  edgingOrderWastagePercent: 0,
  edgingOrderRoundUpMetre: false,
  onlyWhenOrderFromSet: true,
  masoniteOneFullSheetFromCutHouse: false,
  masoniteHb001Explicit: false,
};

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
  cutHouseCharges: { ...DEFAULT_CUT_HOUSE_CHARGES },
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

/** Kickplate and feet: kitchen floor (including spice / tall floor), and every bedroom cupboard. */
export function showsKickplate(unit: { type: UnitType; carcass?: { mountType?: MountType } }): boolean {
  if (unit.type === 'bedroom') return true;
  return isKitchenBase(unit.type) && isFloorUnit(unit);
}

export const MOUNT_TYPE_LABELS = {
  floor: 'Floor unit',
  floor_corner: 'Floor corner',
  tall_floor: 'Tall Floor unit',
  wall: 'Wall unit',
  wall_corner: 'Wall corner',
  spice: 'Spice cupboard',
} as const;

/** Mount choices shown per unit type. */
export function mountTypesForUnitType(type: UnitType): MountType[] {
  if (type === 'wall') return ['wall', 'wall_corner'];
  if (type === 'kitchen_base') return ['floor', 'floor_corner', 'tall_floor', 'spice', 'wall'];
  return ['floor', 'wall'];
}

export function isSpiceCupboard(unit: { type?: UnitType; carcass?: { mountType?: MountType } }): boolean {
  return unit.type === 'kitchen_base' && unit.carcass?.mountType === 'spice';
}

export function isFloorCorner(unit: { type?: UnitType; carcass?: { mountType?: MountType } }): boolean {
  return unit.type === 'kitchen_base' && unit.carcass?.mountType === 'floor_corner';
}

/** Kitchen base tall cupboard: wall-style carcass (Top + 2 fillers) standing on a plinth. */
export function isTallFloor(unit: { type?: UnitType; carcass?: { mountType?: MountType } }): boolean {
  return unit.type === 'kitchen_base' && unit.carcass?.mountType === 'tall_floor';
}

/**
 * Wall-style carcass: full Top panel + 2 top fillers by default (no countertop type).
 * Pure wall units and kitchen tall floor. With melamine backing, Top filler may be "No Filler".
 */
export function usesWallStyleCarcass(unit: { type?: UnitType; carcass?: { mountType?: MountType } }): boolean {
  if (isTallFloor(unit)) return true;
  return unit.type === 'wall' && (unit.carcass?.mountType ?? 'wall') === 'wall';
}

export function isWallCorner(unit: { type?: UnitType; carcass?: { mountType?: MountType } }): boolean {
  return unit.type === 'wall' && unit.carcass?.mountType === 'wall_corner';
}

export function isFloorUnit(unit: { carcass?: { mountType?: MountType } }): boolean {
  const m = unit.carcass?.mountType ?? 'floor';
  return m === 'floor' || m === 'spice' || m === 'floor_corner' || m === 'tall_floor';
}

export function isWallUnit(unit: { carcass?: { mountType?: MountType } }): boolean {
  const m = unit.carcass?.mountType;
  return m === 'wall' || m === 'wall_corner';
}

/** Old jobs: spice / floor corner / tall floor only on kitchen base; wall corner only on wall. */
export function normalizeMountType(type: UnitType, mountType: MountType | undefined): MountType {
  const m = mountType ?? (type === 'wall' ? 'wall' : 'floor');
  if ((m === 'spice' || m === 'floor_corner' || m === 'tall_floor') && type !== 'kitchen_base') {
    return type === 'wall' ? 'wall' : 'floor';
  }
  if (m === 'wall_corner' && type !== 'wall') return type === 'kitchen_base' ? 'floor' : 'floor';
  if (!mountTypesForUnitType(type).includes(m)) {
    return type === 'wall' ? 'wall' : 'floor';
  }
  return m;
}

export function defaultPlinth(job: { settings: JobSettings; materials: Material[] }, visibleMatId?: string): KitchenPlinthConfig {
  const kickplateMaterialId = visibleMatId ?? job.materials[0]?.id ?? 'mat-white';
  const boardMat = job.materials.find((m) => m.id === kickplateMaterialId);
  return {
    kickplateType: 'wood',
    kickplateCoverage: 'front',
    kickplateSide: 'left',
    kickplateMaterialId,
    kickplateEdgingLongCount: 1,
    kickplateEdgingShortCount: 0,
    kickplateEdgingMaterialId: boardMat?.edgingMaterialId,
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
  largePricePerSheet: 475,
  largeSheetWidth: 2750,
  largeSheetHeight: 1830,
  largeColour: 'Brown',
  largeThickness: 3,
  largeSheetPurchaseUnit: 'quarter',
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
