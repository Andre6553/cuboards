import type { Job, ScrewLine, Unit } from '../types';
import { calcCustomPackLines, usesGelmarCatalog } from './hardwarePricing';
import { getScrewById, SCREW_CATALOG } from './screwCatalog';
import { isActiveDrawer, resolveFrontQty } from './drawerRules';

/** Gelmar screw IDs (SKU-based). */
export const SCREW_ID_CHIPBOARD_4x16 = 'gelmar-4386';
export const SCREW_ID_DRYWALL_3_5x28 = 'gelmar-1049';
export const SCREW_ID_DRYWALL_3_5x32 = 'gelmar-4360';
export const SCREW_ID_DRYWALL_6x32 = 'gelmar-1037';

/** Default usage rates — screws per cupboard (or per drawer front where noted). */
export const DEFAULT_SCREW_USAGE = {
  chipboardPerCupboard: 25,
  drywall28PerDrawerFront: 3,
  drywall32PerCupboard: 4,
  drywall6PerDrawer: 8,
  drywall6PerCupboard: 20,
} as const;

export function activeDrawerBoxesPerCupboard(unit: Unit): number {
  return unit.drawers.filter(isActiveDrawer).reduce((sum, d) => sum + d.qty, 0);
}

export function activeDrawerFrontsPerCupboard(unit: Unit): number {
  return unit.drawers.filter(isActiveDrawer).reduce((sum, d) => sum + d.qty * resolveFrontQty(d), 0);
}

function usageDetailForScrew(screwId: string, totalScrews: number): string {
  const u = DEFAULT_SCREW_USAGE;
  switch (screwId) {
    case SCREW_ID_CHIPBOARD_4x16:
      return `${u.chipboardPerCupboard}/cupboard`;
    case SCREW_ID_DRYWALL_3_5x28:
      return `${u.drywall28PerDrawerFront}/drawer front`;
    case SCREW_ID_DRYWALL_3_5x32:
      return `${u.drywall32PerCupboard}/cupboard`;
    case SCREW_ID_DRYWALL_6x32:
      return `${u.drywall6PerCupboard}/cupboard + ${u.drywall6PerDrawer}/drawer`;
    default:
      return `${totalScrews} total`;
  }
}

/** Job-wide screw totals from all units on the cut list. */
export function calcJobScrews(job: Job): ScrewLine[] {
  if (!usesGelmarCatalog(job, 'screws')) {
    return calcCustomPackLines(job, 'screws');
  }

  const totals = new Map<string, number>();

  for (const unit of job.units) {
    const cupboards = Math.max(0, unit.unitQty ?? 0);
    if (cupboards <= 0) continue;
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

  const lines: ScrewLine[] = [];
  for (const entry of SCREW_CATALOG) {
    const totalScrews = totals.get(entry.id);
    if (!totalScrews || totalScrews <= 0) continue;
    const packsNeeded = Math.ceil(totalScrews / entry.packSize);
    const packPrice = job.screwPrices?.[entry.id] ?? entry.defaultPackPrice;
    lines.push({
      screwId: entry.id,
      name: entry.name,
      sku: entry.sku,
      totalScrews,
      packSize: entry.packSize,
      packsNeeded,
      packPrice,
      subtotal: packsNeeded * packPrice,
      usageDetail: usageDetailForScrew(entry.id, totalScrews),
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
