import type { CarcassConfig, Material, Unit } from '../types';

export {
  resolveBedroomWallSideFillerEdging,
  resolveBedroomWallTopFillerEdging,
  resolveFillerEdgeCounts,
} from './kickplateEdging';

/** White melamine board (internal white carcass). */
export function isWhiteMelamine(materials: Material[], materialId: string): boolean {
  const m = materials.find((mat) => mat.id === materialId);
  if (!m) return false;
  const name = m.name.toLowerCase();
  const colour = m.colour.toLowerCase();
  const isWhite = name.includes('white') || colour.includes('white');
  const isMelamine = name.includes('melamine');
  return isWhite && isMelamine;
}

/** Both sides white → user picks filler; otherwise fillers match side board + edging. */
export function resolveFillerMaterial(carcass: CarcassConfig, materials: Material[]): string {
  const leftWhite = isWhiteMelamine(materials, carcass.leftMaterialId);
  const rightWhite = isWhiteMelamine(materials, carcass.rightMaterialId);
  if (leftWhite && rightWhite) {
    return carcass.fillerMaterialId;
  }
  if (carcass.leftMaterialId === carcass.rightMaterialId) {
    return carcass.leftMaterialId;
  }
  return carcass.leftMaterialId;
}

export function fillersFollowSideMaterial(carcass: CarcassConfig, materials: Material[]): boolean {
  return !(isWhiteMelamine(materials, carcass.leftMaterialId) && isWhiteMelamine(materials, carcass.rightMaterialId));
}

/**
 * Top filler strips, same rule as a floor unit.
 * Granite / stone → 2 (front + back). Wooden top → 3 (plus centre).
 * Wall mount uses this when the unit is a wall unit or a kitchen base.
 * A bedroom wall unit uses optional side and top fillers instead.
 */
export function topFillerCount(unit: Pick<Unit, 'type' | 'carcass'>): number {
  const mount = unit.carcass.mountType ?? 'floor';
  if (mount === 'wall' && unit.type !== 'wall' && unit.type !== 'kitchen_base') return 0;
  return unit.carcass.countertopType === 'wooden' ? 3 : 2;
}

export function isBedroomWallUnit(unit: Pick<Unit, 'type' | 'carcass'>): boolean {
  return unit.type === 'bedroom' && (unit.carcass.mountType ?? 'floor') === 'wall';
}

export function resolveBedroomWallSideFiller(unit: Pick<Unit, 'height' | 'carcass'>): {
  width: number;
  length: number;
  qty: number;
} {
  const c = unit.carcass;
  const width = Math.max(1, Math.round(c.sideFillerWidth ?? c.fillerWidth ?? 0));
  const length = Math.max(1, Math.round(c.sideFillerHeight ?? unit.height));
  const qty = Math.max(0, Math.round(c.sideFillerQty ?? 2));
  return { width, length, qty };
}

export function resolveBedroomWallTopFiller(unit: Pick<Unit, 'width' | 'carcass'>): {
  width: number;
  length: number;
  qty: number;
} {
  const c = unit.carcass;
  const width = Math.max(1, Math.round(c.topFillerWidth ?? c.fillerWidth ?? 0));
  const length = Math.max(1, Math.round(c.topFillerHeight ?? unit.width));
  const qty = Math.max(0, Math.round(c.topFillerQty ?? 2));
  return { width, length, qty };
}

/** Optional bedroom wall fillers. Sizes and qty are user-typed; defaults match the old 2 × filler width × carcass. */
export function bedroomWallFillerPieces(unit: Pick<Unit, 'type' | 'width' | 'height' | 'carcass'>): {
  side: { width: number; length: number; qty: number } | null;
  top: { width: number; length: number; qty: number } | null;
} {
  if (!isBedroomWallUnit(unit)) return { side: null, top: null };
  const side = unit.carcass.sideFillers ? resolveBedroomWallSideFiller(unit) : null;
  const top = unit.carcass.topFillers ? resolveBedroomWallTopFiller(unit) : null;
  return {
    side: side && side.qty > 0 && side.width > 0 && side.length > 0 ? side : null,
    top: top && top.qty > 0 && top.width > 0 && top.length > 0 ? top : null,
  };
}

/** Melamine back panel sits inside carcass: W−2T × (H−T). */
export function melamineBackingSize(width: number, height: number, thickness: number) {
  return {
    width: width - 2 * thickness,
    height: height - thickness,
  };
}

/** Masonite panel — 2 mm clearance on length and width. */
export function masonitePanelSize(length: number, width: number) {
  return {
    length: Math.max(0, length - 2),
    width: Math.max(0, width - 2),
  };
}

/** Masonite carcass back — outer carcass face minus 2 mm each way. */
export function masoniteBackingSize(width: number, height: number) {
  const panel = masonitePanelSize(height, width);
  return { width: panel.width, height: panel.length };
}
