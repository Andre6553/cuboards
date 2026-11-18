import type { CarcassConfig, Material, Unit } from '../types';
import { usesWallStyleCarcass } from './constants';

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

/**
 * Filler board is always the user-selected `fillerMaterialId`.
 * Falls back to left side (then right) if unset — e.g. older jobs.
 */
export function resolveFillerMaterial(carcass: CarcassConfig, _materials?: Material[]): string {
  return carcass.fillerMaterialId || carcass.leftMaterialId || carcass.rightMaterialId || '';
}

/** @deprecated Fillers are always user-picked; kept for old call sites. */
export function fillersFollowSideMaterial(_carcass: CarcassConfig, _materials: Material[]): boolean {
  return false;
}

/**
 * Top filler strips, same rule as a floor unit.
 * Granite / stone → 2 (front + back). Wooden top → 3 (plus centre).
 * Floor + solid melamine backing: granite → 1 (front only); non-granite → 2 (front + back, no centre).
 * Wall-style carcass (pure wall + kitchen tall floor): always 2 fillers (no countertop type).
 * Kitchen base on wall mount uses fillers like a floor unit. Bedroom wall uses optional ticks.
 */
export function topFillerCount(unit: Pick<Unit, 'type' | 'carcass'>): number {
  const mount = unit.carcass.mountType ?? 'floor';
  if (mount === 'floor_corner' || mount === 'wall_corner') return 0;
  if (usesWallStyleCarcass(unit)) return 2;
  if (mount === 'wall' && unit.type !== 'kitchen_base') return 0;
  if (mount === 'floor' && (unit.carcass.backingType ?? 'none') === 'melamine') {
    return (unit.carcass.countertopType ?? 'granite') === 'granite' ? 1 : 2;
  }
  return unit.carcass.countertopType === 'wooden' ? 3 : 2;
}

/**
 * Solid melamine back W−2T × H−2T with grain along height.
 * Floor, tall floor, and all wall mounts (pure wall, kitchen/bedroom wall).
 */
export function usesFullHeightMelamineBack(unit: Pick<Unit, 'type' | 'carcass'>): boolean {
  if ((unit.carcass.backingType ?? 'none') !== 'melamine') return false;
  const mount = unit.carcass.mountType ?? 'floor';
  return mount === 'floor' || mount === 'tall_floor' || mount === 'wall';
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

/**
 * Melamine back panel sits inside carcass.
 * Default (other mounts): W−2T × (H−T).
 * Floor, tall floor, wall: W−2T × (H−2T) — grain runs along height (length).
 */
export function melamineBackingSize(
  width: number,
  height: number,
  thickness: number,
  opts?: { heightClearances?: 1 | 2 },
) {
  const heightClearances = opts?.heightClearances ?? 1;
  return {
    width: Math.max(0, width - 2 * thickness),
    height: Math.max(0, height - heightClearances * thickness),
  };
}

/** Shelf plan size — depth × width between sides. Solid melamine back shortens depth by T. */
export function carcassShelfSize(
  depth: number,
  internalWidth: number,
  thickness: number,
  backingType: CarcassConfig['backingType'],
): { depth: number; width: number } {
  const shelfDepth = backingType === 'melamine' ? Math.max(0, depth - thickness) : depth;
  return { depth: shelfDepth, width: internalWidth };
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
