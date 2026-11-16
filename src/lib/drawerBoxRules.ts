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
 * Drawer box front & back **width** (mm).
 *
 * Inner carcass width (W − 2×T) minus runner bay each side:
 * = (W − 2×T) − 2×runner side clearance.
 */
export function drawerBoxFrontBackWidth(
  carcassWidth: number,
  boardThickness: number,
  sideClearance: number,
): number {
  const internalWidth = carcassInternalWidth(carcassWidth, boardThickness);
  return internalWidth - 2 * sideClearance;
}

/**
 * Drawer box side panel **depth** (mm) — height on cut list is user `boxHeight`.
 *
 * = carcass depth − back clearance − 2×board thickness
 * (front clearance is for runners / facade gap, not side panel depth)
 */
export function drawerBoxSideDepth(
  cupboardDepth: number,
  backClearance: number,
  boardThickness: number,
): number {
  return cupboardDepth - backClearance - 2 * boardThickness;
}

/** Masonite drop-in — cavity inside front/back + sides (−2T each way). */
export function drawerBoxInnerSize(
  frontBackWidth: number,
  sideDepth: number,
  boardThickness: number,
): { width: number; depth: number } {
  return {
    width: frontBackWidth - 2 * boardThickness,
    depth: sideDepth - 2 * boardThickness,
  };
}

/**
 * Solid melamine bottom — same **depth** as drawer side panel; width = inner between front/back.
 * Cut list: sideDepth × (frontBackWidth − 2×T), e.g. 411 × 336.
 */
export function drawerBoxSolidBottomSize(
  frontBackWidth: number,
  sideDepth: number,
  boardThickness: number,
): { width: number; depth: number } {
  return {
    width: Math.max(0, frontBackWidth - 2 * boardThickness),
    depth: Math.max(0, sideDepth),
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
    `− 2×${sideClearance} mm runner clearance`
  );
}

export function drawerBoxSideDepthNote(
  cupboardDepth: number,
  backClearance: number,
  boardThickness: number,
): string {
  const depth = drawerBoxSideDepth(cupboardDepth, backClearance, boardThickness);
  return (
    `${depth} mm = ${cupboardDepth} mm carcass depth − ${backClearance} mm back clearance − 2×${boardThickness} mm board`
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
