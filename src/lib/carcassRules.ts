import type { CarcassConfig, Material } from '../types';

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
