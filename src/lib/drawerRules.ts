import type { DrawerConfig, DrawerGaps, Job, Unit } from '../types';
import { formatPanelCutSizeSummary, panelCutSizes } from './edgingCutSize';

export const DEFAULT_DRAWER_GAPS: DrawerGaps = {
  left: 2,
  right: 2,
  top: 2,
  bottom: 2,
  between: 2,
};

export const DEFAULT_FRONT_OVERHANG_MM = 10;
export const DEFAULT_GAP_TO_DOOR_MM = 2;

export function resolveDrawerBoxMaterialId(drawer: DrawerConfig): string {
  return drawer.boxMaterialId ?? drawer.materialId ?? '';
}

export function resolveDrawerFrontMaterialId(drawer: DrawerConfig): string {
  return drawer.frontMaterialId ?? drawer.materialId ?? '';
}

export function isActiveDrawer(drawer: DrawerConfig): boolean {
  return drawer.qty > 0;
}

export function activeDrawers(drawers: DrawerConfig[]): DrawerConfig[] {
  return drawers.filter(isActiveDrawer);
}

export function resolveDrawerGaps(drawer: DrawerConfig): DrawerGaps {
  return drawer.gaps ?? DEFAULT_DRAWER_GAPS;
}

export function resolveFrontOverhang(drawer: DrawerConfig): number {
  return drawer.frontOverhangMm ?? DEFAULT_FRONT_OVERHANG_MM;
}

/** Drawer fronts side by side in one row (not qty per cupboard). */
export function resolveFrontQty(drawer: DrawerConfig): number {
  return Math.max(1, drawer.frontQty ?? 1);
}

export function resolveGapToDoor(drawer: DrawerConfig): number {
  return drawer.gapToDoorMm ?? DEFAULT_GAP_TO_DOOR_MM;
}

/** Finished visible drawer front height = box height + overhang above box. */
export function drawerFrontPanelHeight(drawer: DrawerConfig): number {
  return drawer.boxHeight + resolveFrontOverhang(drawer);
}

/**
 * Carcass row height for an active drawer.
 * top gap + front panel + bottom gap + (gap to door when a door is below).
 */
export function targetDrawerOpeningHeight(drawer: DrawerConfig, hasDoorBelow = false): number {
  const gaps = resolveDrawerGaps(drawer);
  const panel = drawerFrontPanelHeight(drawer);
  const gapToDoor = hasDoorBelow ? resolveGapToDoor(drawer) : 0;
  return Math.round((gaps.top + panel + gaps.bottom + gapToDoor) * 10) / 10;
}

/** Set opening row height from front panel + gaps (+ gap to door). Inactive drawers (qty 0) unchanged. */
export function syncDrawerOpeningFromFront(drawer: DrawerConfig, hasDoorBelow = false): DrawerConfig {
  if (!isActiveDrawer(drawer)) return drawer;
  return {
    ...drawer,
    openingHeight: targetDrawerOpeningHeight(drawer, hasDoorBelow),
  };
}

/** Visible drawer front (facade) width — one leaf. */
export function drawerFrontWidth(drawer: DrawerConfig): number {
  if (!isActiveDrawer(drawer)) return 0;
  const gaps = resolveDrawerGaps(drawer);
  const frontQty = resolveFrontQty(drawer);
  const betweenTotal = (frontQty - 1) * gaps.between;
  return (drawer.openingWidth - gaps.left - gaps.right - betweenTotal) / frontQty;
}

/** Finished drawer front panel height for cut list (box + overhang). */
export function drawerFrontHeight(drawer: DrawerConfig): number {
  return drawerFrontPanelHeight(drawer);
}

export function drawerFrontCutListSize(
  drawer: DrawerConfig,
  ctx: Pick<Job, 'settings' | 'edgingMaterials' | 'materials'>,
): { width: number; length: number; finishedWidth: number; finishedHeight: number; sizeNote: string } {
  const finishedWidth = drawerFrontWidth(drawer);
  const finishedHeight = drawerFrontHeight(drawer);
  const panel = panelCutSizes(
    ctx as Job,
    resolveDrawerFrontMaterialId(drawer),
    finishedWidth,
    finishedHeight,
    drawer.frontEdgingPattern,
    drawer.frontEdgingMaterialId,
  );
  return {
    width: panel.cutWidth,
    length: panel.cutHeight,
    finishedWidth,
    finishedHeight,
    sizeNote: panel.sizeNote,
  };
}

export function drawerSizeSummary(
  drawer: DrawerConfig,
  ctx: Pick<Job, 'settings' | 'edgingMaterials' | 'materials'>,
  hasDoorBelow = false,
): string {
  if (!isActiveDrawer(drawer)) {
    return 'Qty 0 — no drawer parts on cut list. Door uses full cupboard height.';
  }
  const gaps = resolveDrawerGaps(drawer);
  const overhang = resolveFrontOverhang(drawer);
  const gapToDoor = hasDoorBelow ? resolveGapToDoor(drawer) : 0;
  const finishedWidth = drawerFrontWidth(drawer);
  const finishedHeight = drawerFrontHeight(drawer);
  const panel = panelCutSizes(
    ctx as Job,
    resolveDrawerFrontMaterialId(drawer),
    finishedWidth,
    finishedHeight,
    drawer.frontEdgingPattern,
    drawer.frontEdgingMaterialId,
  );
  const frontQty = resolveFrontQty(drawer);
  const perCupboard = drawer.qty;
  const between = frontQty > 1 ? ` · ${gaps.between} mm between fronts` : '';
  const rowPart = hasDoorBelow
    ? `Opening row ${drawer.openingHeight} mm (T${gaps.top}+front ${finishedHeight}+B${gaps.bottom}+${gapToDoor} to door)`
    : `Opening row ${drawer.openingHeight} mm`;
  const cutPart = formatPanelCutSizeSummary(panel);
  const qtyPart = frontQty > 1
    ? `${perCupboard}× per cupboard · ${frontQty} fronts/row · `
    : `${perCupboard}× per cupboard · `;
  return (
    `${qtyPart}` +
    `finished ${finishedWidth} × ${finishedHeight} mm (box ${drawer.boxHeight} + ${overhang} mm overhang) · ` +
    `L${gaps.left} R${gaps.right} mm · ${rowPart}${between} · ${cutPart}`
  );
}

export function totalActiveDrawerOpeningHeight(unit: Unit): number {
  return activeDrawers(unit.drawers).reduce((sum, d) => sum + d.openingHeight, 0);
}
