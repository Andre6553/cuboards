import { isFloorUnit } from './constants';
import { isWhiteMelamine } from './carcassRules';
import type { CarcassConfig, Job, Material, Unit } from '../types';

/** Extra corner blocks when carcass uses solid melamine backing (inside carcass). */
export const CORNER_BLOCKS_MELAMINE_BACKING = 4;

/** Floor units: top filler strips under stone/laminate top (matches cut list). */
export function floorTopFillerCount(unit: Unit): number {
  if (!isFloorUnit(unit)) return 0;
  return unit.carcass.countertopType === 'wooden' ? 3 : 2;
}

/**
 * Visible carcass sides (0, 1, or 2) — drives corner block qty.
 * Explicit `leftVisible` / `rightVisible` on the unit override inference.
 */
export function visibleSideCount(carcass: CarcassConfig, materials: Material[]): 0 | 1 | 2 {
  if (carcass.leftVisible !== undefined || carcass.rightVisible !== undefined) {
    const left = carcass.leftVisible === true;
    const right = carcass.rightVisible === true;
    return Math.min(2, (left ? 1 : 0) + (right ? 1 : 0)) as 0 | 1 | 2;
  }
  const lId = carcass.leftMaterialId;
  const rId = carcass.rightMaterialId;
  if (lId === rId) {
    if (isWhiteMelamine(materials, lId)) return 0;
    return 2;
  }
  return 1;
}

export function resolveLeftSideVisible(carcass: CarcassConfig, materials: Material[]): boolean {
  if (carcass.leftVisible !== undefined) return carcass.leftVisible;
  const v = visibleSideCount(carcass, materials);
  if (v === 0) return false;
  if (v === 2) return true;
  const lW = isWhiteMelamine(materials, carcass.leftMaterialId);
  const rW = isWhiteMelamine(materials, carcass.rightMaterialId);
  if (!lW && rW) return true;
  if (lW && !rW) return false;
  return carcass.leftMaterialId !== carcass.rightMaterialId;
}

export function resolveRightSideVisible(carcass: CarcassConfig, materials: Material[]): boolean {
  if (carcass.rightVisible !== undefined) return carcass.rightVisible;
  const v = visibleSideCount(carcass, materials);
  if (v === 0) return false;
  if (v === 2) return true;
  const lW = isWhiteMelamine(materials, carcass.leftMaterialId);
  const rW = isWhiteMelamine(materials, carcass.rightMaterialId);
  if (lW && !rW) return true;
  if (!lW && rW) return false;
  return false;
}

function melamineBackingCornerBlocks(carcass: CarcassConfig): number {
  return (carcass.backingType ?? 'none') === 'melamine' ? CORNER_BLOCKS_MELAMINE_BACKING : 0;
}

/** Corner blocks per single cupboard (before unitQty). */
export function cornerBlocksPerCupboard(unit: Unit, materials: Material[]): number {
  const v = visibleSideCount(unit.carcass, materials);
  const backingExtra = melamineBackingCornerBlocks(unit.carcass);

  if (v === 0) return backingExtra;

  const perShelf = v === 2 ? 4 : 2;
  const perFiller = v === 2 ? 2 : 1;
  const shelves = Math.max(0, unit.carcass.shelfQty ?? 0);
  const fillers = floorTopFillerCount(unit);

  return shelves * perShelf + fillers * perFiller + backingExtra;
}

export function totalCornerBlocksOnJob(job: Job): number {
  const materials = job.materials ?? [];
  let total = 0;
  for (const unit of job.units) {
    const cupboards = Math.max(0, unit.unitQty ?? 0);
    if (cupboards <= 0) continue;
    total += cornerBlocksPerCupboard(unit, materials) * cupboards;
  }
  return total;
}

export function cornerBlockUsageDetail(unit: Unit, materials: Material[]): string {
  const v = visibleSideCount(unit.carcass, materials);
  const backingExtra = melamineBackingCornerBlocks(unit.carcass);
  const n = cornerBlocksPerCupboard(unit, materials);
  if (n === 0) return 'No corner blocks';

  const parts: string[] = [];
  if (v === 0) {
    parts.push('no visible sides');
  } else {
    const perShelf = v === 2 ? 4 : 2;
    const perFiller = v === 2 ? 2 : 1;
    const shelves = Math.max(0, unit.carcass.shelfQty ?? 0);
    const fillers = floorTopFillerCount(unit);
    parts.push(
      `${shelves} shelf×${perShelf} + ${fillers} filler×${perFiller} (${v} visible side${v === 1 ? '' : 's'})`,
    );
  }
  if (backingExtra > 0) {
    parts.push(`+${backingExtra} solid melamine backing`);
  }
  return `${n}/cupboard · ${parts.join(' · ')}`;
}
