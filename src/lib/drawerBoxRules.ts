import type { DrawerConfig, EdgingPattern } from '../types';

/** Drawer box front & back panels — top long edge + both short ends. */
export const DRAWER_BOX_FRONT_BACK_EDGING: EdgingPattern = '1_long_2_short';

/** Drawer box side panels — one long edge (top). */
export const DRAWER_BOX_SIDE_EDGING: EdgingPattern = '1_long';

/** Internal width between carcass side panels. */
export function carcassInternalWidth(carcassWidth: number, boardThickness: number): number {
  return carcassWidth - 2 * boardThickness;
}

/**
 * Drawer box front/back panel width (mm) — panels sit between the box sides.
 *
 * = carcass width − 2×carcass T − 2×runner side clearance − 2×box T
 * e.g. 500 − 32 − 26 − 32 = 410 mm (16 mm board, 13 mm runner clearance)
 */
export function drawerBoxFrontBackWidth(
  carcassWidth: number,
  boardThickness: number,
  sideClearance: number,
): number {
  const internalWidth = carcassInternalWidth(carcassWidth, boardThickness);
  return internalWidth - 2 * sideClearance - 2 * boardThickness;
}

/**
 * Drawer box side panel depth (mm) — 1 long edge on top.
 *
 * = cupboard depth − front clearance − back clearance
 * (front/back clearances default 20 + 5 = 25 mm, matching typical runner depth deduction)
 */
export function drawerBoxSideDepth(
  cupboardDepth: number,
  frontClearance: number,
  backClearance: number,
): number {
  return cupboardDepth - frontClearance - backClearance;
}

/** Inside the box, for a drop-in bottom (no groove). Front/back sit between the sides. */
export function drawerBoxInnerSize(
  frontBackWidth: number,
  sideDepth: number,
  boardThickness: number,
): { width: number; depth: number } {
  return {
    width: frontBackWidth,
    depth: sideDepth - 2 * boardThickness,
  };
}

export function drawerBoxFrontBackWidthNote(
  carcassWidth: number,
  boardThickness: number,
  sideClearance: number,
): string {
  const internalWidth = carcassInternalWidth(carcassWidth, boardThickness);
  const width = drawerBoxFrontBackWidth(carcassWidth, boardThickness, sideClearance);
  return (
    `${width} mm = ${carcassWidth} mm − 2×${boardThickness} mm carcass (${internalWidth} mm) ` +
    `− 2×${sideClearance} mm runner − 2×${boardThickness} mm box sides`
  );
}

export function drawerBoxSideDepthNote(
  cupboardDepth: number,
  frontClearance: number,
  backClearance: number,
): string {
  const depth = drawerBoxSideDepth(cupboardDepth, frontClearance, backClearance);
  return (
    `${depth} mm = ${cupboardDepth} mm depth − ${frontClearance} mm front clearance − ${backClearance} mm back clearance`
  );
}

/** Nearest stock runner length that still fits (50 mm steps, round down). */
export function stockRunnerLengthMm(cupboardDepth: number, runnerLengthOffset: number): number {
  const raw = cupboardDepth - runnerLengthOffset;
  return Math.max(250, Math.floor(raw / 50) * 50);
}

export function resolveDrawerBoxFrontBackEdgingPattern(drawer: DrawerConfig): EdgingPattern {
  return drawer.boxFrontBackEdgingPattern ?? DRAWER_BOX_FRONT_BACK_EDGING;
}

export function resolveDrawerBoxSideEdgingPattern(drawer: DrawerConfig): EdgingPattern {
  return drawer.boxSideEdgingPattern ?? drawer.boxEdgingPattern ?? DRAWER_BOX_SIDE_EDGING;
}
