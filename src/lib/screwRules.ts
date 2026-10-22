import type { Job, ScrewLine, Unit } from '../types';
import { isFloorUnit } from './constants';
import { calcCustomPackLines, usesGelmarCatalog } from './hardwarePricing';
import { getScrewById, SCREW_CATALOG, type ScrewCatalogEntry } from './screwCatalog';
import { SCREWS_PER_CORNER_BLOCK } from './connectingFittingRules';
import { totalCornerBlocksOnJob } from './cornerBlockRules';
import { isActiveDrawer, resolveFrontQty } from './drawerRules';

/** Gelmar screw IDs (SKU-based). */
export const SCREW_ID_CHIPBOARD_4x16 = 'gelmar-4386';
export const SCREW_ID_DRYWALL_3_5x28 = 'gelmar-1049';
export const SCREW_ID_DRYWALL_3_5x28_120 = 'gelmar-4359';
export const SCREW_ID_DRYWALL_3_5x32 = 'gelmar-4360';
export const SCREW_ID_DRYWALL_3_5x41 = 'gelmar-4372';
export const SCREW_ID_DRYWALL_3_5x41_80 = 'gelmar-4361';
export const SCREW_ID_DRYWALL_6x32 = 'gelmar-1037';

/** Primary catalog id per size — used for usage-detail text when multiple pack SKUs exist. */
const USAGE_SCREW_ID_BY_SIZE: Record<string, string> = {
  '4x16': SCREW_ID_CHIPBOARD_4x16,
  '3.5x28': SCREW_ID_DRYWALL_3_5x28,
  '3.5x32': SCREW_ID_DRYWALL_3_5x32,
  '3.5x41': SCREW_ID_DRYWALL_3_5x41,
  '6x32': SCREW_ID_DRYWALL_6x32,
};

function screwSizeKey(entry: ScrewCatalogEntry): string {
  return `${entry.diameterMm}x${entry.lengthMm}`;
}

function catalogPacksForSizeKey(sizeKey: string): ScrewCatalogEntry[] {
  return SCREW_CATALOG.filter((e) => screwSizeKey(e) === sizeKey);
}

/**
 * Gelmar pack choice: if need fits in the smaller pack, buy one small pack;
 * otherwise buy the larger pack size (ceil to full large packs).
 */
export function pickGelmarPackByQuantity(
  totalScrews: number,
  packs: ScrewCatalogEntry[],
): { entry: ScrewCatalogEntry; packsNeeded: number } {
  const sorted = [...packs].sort((a, b) => a.packSize - b.packSize);
  const small = sorted[0];
  const large = sorted[sorted.length - 1];
  if (totalScrews <= small.packSize) {
    return { entry: small, packsNeeded: 1 };
  }
  return { entry: large, packsNeeded: Math.ceil(totalScrews / large.packSize) };
}

/** @deprecated Wall units and legacy docs — floor units use {@link calcFloorUnitScrewTotals}. */
export const DEFAULT_SCREW_USAGE = {
  chipboardPerCupboard: 25,
  drywall28PerDrawerFront: 3,
  drywall32PerCupboard: 4,
  drywall6PerDrawer: 8,
  drywall6PerCupboard: 20,
} as const;

/** One exposed end: left and right side boards use different materials. */
export function exposedCarcassSideCount(unit: Unit): number {
  return unit.carcass.leftMaterialId !== unit.carcass.rightMaterialId ? 1 : 0;
}

export function activeDrawerBoxesPerCupboard(unit: Unit): number {
  return unit.drawers.filter(isActiveDrawer).reduce((sum, d) => sum + d.qty, 0);
}

export function activeDrawerFrontsPerCupboard(unit: Unit): number {
  return unit.drawers.filter(isActiveDrawer).reduce((sum, d) => sum + d.qty * resolveFrontQty(d), 0);
}

/** Floor cupboard screw counts (per single cupboard, before unitQty). */
export function calcFloorUnitScrewTotals(unit: Unit): Map<string, number> {
  const totals = new Map<string, number>();
  const add = (screwId: string, qty: number) => {
    if (qty <= 0) return;
    totals.set(screwId, (totals.get(screwId) ?? 0) + qty);
  };

  const exposed = exposedCarcassSideCount(unit);
  if (exposed === 0) {
    add(SCREW_ID_DRYWALL_3_5x41, 12);
  } else {
    add(SCREW_ID_DRYWALL_3_5x41, 6);
    add(SCREW_ID_CHIPBOARD_4x16, 12);
  }

  for (const drawer of unit.drawers.filter(isActiveDrawer)) {
    const perBox = drawer.bottomType === 'solid' ? 12 : 8;
    add(SCREW_ID_DRYWALL_3_5x41, perBox * drawer.qty);
  }

  const fronts = activeDrawerFrontsPerCupboard(unit);
  if (fronts > 0) {
    add(SCREW_ID_DRYWALL_3_5x28, 4 * fronts);
  }

  return totals;
}

function usageDetailForScrewLine(screwId: string, hasFloor: boolean, hasWall: boolean): string {
  const parts: string[] = [];
  if (hasFloor) {
    switch (screwId) {
      case SCREW_ID_DRYWALL_3_5x41:
        parts.push(
          '12/cupboard carcass (no exposed side) or 6 (one exposed side); 8/drawer masonite bottom or 12 solid',
        );
        break;
      case SCREW_ID_CHIPBOARD_4x16:
        parts.push(`${SCREWS_PER_CORNER_BLOCK}/corner block (see corner block line)`);
        parts.push('12/cupboard (one exposed side · carcass)');
        break;
      default:
        break;
    }
  }
  if (hasWall) {
    const u = DEFAULT_SCREW_USAGE;
    switch (screwId) {
      case SCREW_ID_CHIPBOARD_4x16:
        if (!hasFloor) {
          parts.push(`${SCREWS_PER_CORNER_BLOCK}/corner block (see corner block line)`);
        }
        parts.push(`${u.chipboardPerCupboard}/cupboard (wall)`);
        break;
      case SCREW_ID_DRYWALL_3_5x32:
        parts.push(`${u.drywall32PerCupboard}/cupboard (wall)`);
        break;
      case SCREW_ID_DRYWALL_6x32:
        parts.push(`${u.drywall6PerCupboard}/cupboard + ${u.drywall6PerDrawer}/drawer (wall)`);
        break;
      default:
        break;
    }
  }
  if (screwId === SCREW_ID_DRYWALL_3_5x28 || screwId === SCREW_ID_DRYWALL_3_5x28_120) {
    const u = DEFAULT_SCREW_USAGE;
    if (hasFloor) parts.push('4/drawer front (floor · 3.5×28 mm)');
    if (hasWall) parts.push(`${u.drywall28PerDrawerFront}/drawer front (wall · 3.5×28 mm)`);
  }

  return parts.join('; ') || `${screwId} total`;
}

function addWallUnitScrews(unit: Unit, cupboards: number, totals: Map<string, number>): void {
  const drawerFronts = activeDrawerFrontsPerCupboard(unit);
  const drawerBoxes = activeDrawerBoxesPerCupboard(unit);
  const u = DEFAULT_SCREW_USAGE;

  totals.set(
    SCREW_ID_CHIPBOARD_4x16,
    (totals.get(SCREW_ID_CHIPBOARD_4x16) ?? 0) + u.chipboardPerCupboard * cupboards,
  );
  totals.set(
    SCREW_ID_DRYWALL_3_5x32,
    (totals.get(SCREW_ID_DRYWALL_3_5x32) ?? 0) + u.drywall32PerCupboard * cupboards,
  );
  totals.set(
    SCREW_ID_DRYWALL_6x32,
    (totals.get(SCREW_ID_DRYWALL_6x32) ?? 0) +
      (u.drywall6PerCupboard + u.drywall6PerDrawer * drawerBoxes) * cupboards,
  );

  if (drawerFronts > 0) {
    totals.set(
      SCREW_ID_DRYWALL_3_5x28,
      (totals.get(SCREW_ID_DRYWALL_3_5x28) ?? 0) + u.drywall28PerDrawerFront * drawerFronts * cupboards,
    );
  }
}

/** Job-wide screw totals from all units on the cut list. */
export function calcJobScrews(job: Job): ScrewLine[] {
  if (!usesGelmarCatalog(job, 'screws')) {
    return calcCustomPackLines(job, 'screws');
  }

  const totals = new Map<string, number>();
  let hasFloor = false;
  let hasWall = false;

  for (const unit of job.units) {
    const cupboards = Math.max(0, unit.unitQty ?? 0);
    if (cupboards <= 0) continue;

    if (isFloorUnit(unit)) {
      hasFloor = true;
      const perCupboard = calcFloorUnitScrewTotals(unit);
      for (const [screwId, qty] of perCupboard) {
        totals.set(screwId, (totals.get(screwId) ?? 0) + qty * cupboards);
      }
    } else {
      hasWall = true;
      addWallUnitScrews(unit, cupboards, totals);
    }
  }

  const cornerBlocks = totalCornerBlocksOnJob(job);
  if (cornerBlocks > 0) {
    const chipForBlocks = cornerBlocks * SCREWS_PER_CORNER_BLOCK;
    totals.set(SCREW_ID_CHIPBOARD_4x16, (totals.get(SCREW_ID_CHIPBOARD_4x16) ?? 0) + chipForBlocks);
  }

  const neededBySize = new Map<string, number>();
  for (const [screwId, qty] of totals) {
    if (qty <= 0) continue;
    const entry = getScrewById(screwId);
    if (!entry) continue;
    const key = screwSizeKey(entry);
    neededBySize.set(key, (neededBySize.get(key) ?? 0) + qty);
  }

  const lines: ScrewLine[] = [];
  for (const [sizeKey, totalScrews] of neededBySize) {
    const packs = catalogPacksForSizeKey(sizeKey);
    if (packs.length === 0 || totalScrews <= 0) continue;

    const { entry: pick, packsNeeded } = pickGelmarPackByQuantity(totalScrews, packs);
    const packPrice = job.screwPrices?.[pick.id] ?? pick.defaultPackPrice;
    const usageId = USAGE_SCREW_ID_BY_SIZE[sizeKey] ?? pick.id;
    const usageDetail = usageDetailForScrewLine(usageId, hasFloor, hasWall);

    lines.push({
      screwId: pick.id,
      name: pick.name,
      sku: pick.sku,
      totalScrews,
      packSize: pick.packSize,
      packsNeeded,
      packPrice,
      subtotal: packsNeeded * packPrice,
      usageDetail,
    });
  }

  return lines.sort((a, b) => a.name.localeCompare(b.name));
}

export function screwLineDetail(line: ScrewLine): string {
  const entry = getScrewById(line.screwId);
  const spec = entry ? `${entry.diameterMm}×${entry.lengthMm} mm` : '';
  return (
    `${line.totalScrews} screws (${line.usageDetail}) · ` +
    `${line.packsNeeded} pack(s) of ${line.packSize}` +
    (spec ? ` · ${spec}` : '') +
    (line.sku ? ` · SKU ${line.sku}` : '')
  );
}
