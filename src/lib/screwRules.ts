import type { Job, ScrewLine, Unit } from '../types';
import { isFloorUnit } from './constants';
import { calcCustomPackLines, usesGelmarCatalog } from './hardwarePricing';
import { getScrewById, SCREW_CATALOG } from './screwCatalog';
import { isActiveDrawer, resolveFrontQty } from './drawerRules';

/** Gelmar screw IDs (SKU-based). */
export const SCREW_ID_CHIPBOARD_4x16 = 'gelmar-4386';
export const SCREW_ID_DRYWALL_3_5x28 = 'gelmar-1049';
export const SCREW_ID_DRYWALL_3_5x32 = 'gelmar-4360';
export const SCREW_ID_DRYWALL_3_5x41 = 'gelmar-4372';
export const SCREW_ID_DRYWALL_6x32 = 'gelmar-1037';

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
    add(SCREW_ID_DRYWALL_3_5x32, 4 * fronts);
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
        parts.push('12/cupboard (one exposed side)');
        break;
      case SCREW_ID_DRYWALL_3_5x32:
        parts.push('4/drawer front (31 mm nominal · 3.5×32 mm)');
        break;
      default:
        break;
    }
  }
  if (hasWall) {
    const u = DEFAULT_SCREW_USAGE;
    switch (screwId) {
      case SCREW_ID_CHIPBOARD_4x16:
        parts.push(`${u.chipboardPerCupboard}/cupboard (wall)`);
        break;
      case SCREW_ID_DRYWALL_3_5x28:
        parts.push(`${u.drywall28PerDrawerFront}/drawer front (wall)`);
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

  const lines: ScrewLine[] = [];
  for (const entry of SCREW_CATALOG) {
    const totalScrews = totals.get(entry.id);
    if (!totalScrews || totalScrews <= 0) continue;
    const packsNeeded = Math.ceil(totalScrews / entry.packSize);
    const packPrice = job.screwPrices?.[entry.id] ?? entry.defaultPackPrice;
    const usageDetail = usageDetailForScrewLine(entry.id, hasFloor, hasWall);
    lines.push({
      screwId: entry.id,
      name: entry.name,
      sku: entry.sku,
      totalScrews,
      packSize: entry.packSize,
      packsNeeded,
      packPrice,
      subtotal: packsNeeded * packPrice,
      usageDetail,
    });
  }
  return lines;
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
