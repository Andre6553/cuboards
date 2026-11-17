import type { DrawerConfig, DrawerGaps, Job, Unit } from '../types';
import { formatPanelCutSizeSummary, panelCutSizes } from './edgingCutSize';

export const DEFAULT_DRAWER_GAPS: DrawerGaps = {
  left: 2,
  right: 2,
  top: 2,
  bottom: 2,
  between: 2,
};

export const DEFAULT_GAP_TO_DOOR_MM = 2;

/** Vertical gap between stacked drawer fronts on one cupboard. */
export const DRAWER_STACK_GAP_MM = 4;

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

/** Drawer fronts side by side in one row (not qty per cupboard). */
export function resolveFrontQty(drawer: DrawerConfig): number {
  return Math.max(1, drawer.frontQty ?? 1);
}

export function resolveGapToDoor(drawer: DrawerConfig): number {
  return drawer.gapToDoorMm ?? DEFAULT_GAP_TO_DOOR_MM;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Total stacked drawer fronts across all active drawer rows on the unit. */
export function totalDrawerFrontSlots(allDrawers: DrawerConfig[]): number {
  return activeDrawers(allDrawers).reduce((sum, d) => sum + Math.max(1, d.qty), 0);
}

/** Gaps used for the vertical stack (first active drawer row). */
export function resolveDrawerStackGaps(allDrawers: DrawerConfig[]): DrawerGaps {
  const active = activeDrawers(allDrawers);
  return resolveDrawerGaps(active[0] ?? ({ gaps: DEFAULT_DRAWER_GAPS } as DrawerConfig));
}

/**
 * Finished drawer front height (one fascia) from carcass height.
 *
 * (carcass H − top gap − bottom gap − (totalFronts − 1) × 4 mm) ÷ totalFronts
 * (Top/bottom once each — e.g. top 10 mm is not deducted twice.)
 * Width still uses opening width minus L/R (and between when frontQty &gt; 1).
 */
export function drawerFrontPanelHeight(
  drawer: DrawerConfig,
  carcassHeight: number,
  allDrawers: DrawerConfig[] = [drawer],
): number {
  if (!isActiveDrawer(drawer) || carcassHeight <= 0) return 0;
  const totalSlots = totalDrawerFrontSlots(allDrawers);
  if (totalSlots <= 0) return 0;
  const gaps = resolveDrawerStackGaps(allDrawers);
  const usable = carcassHeight - gaps.top - gaps.bottom;
  const betweenTotal = Math.max(0, totalSlots - 1) * DRAWER_STACK_GAP_MM;
  return Math.round(Math.max(0, (usable - betweenTotal) / totalSlots));
}

/**
 * Carcass row height for an active drawer row.
 * top + (qty × front + gaps between fronts) + bottom + (gap to door when a door is below).
 * Custom sizes: use typed `frontHeightMm` instead of the auto carcass split.
 */
export function targetDrawerOpeningHeight(
  drawer: DrawerConfig,
  hasDoorBelow = false,
  carcassHeight?: number,
  allDrawers?: DrawerConfig[],
  customSizes = false,
): number {
  const gaps = resolveDrawerGaps(drawer);
  const gapToDoor = hasDoorBelow ? resolveGapToDoor(drawer) : 0;

  if (isActiveDrawer(drawer)) {
    let front: number | null = null;
    if (customSizes && drawer.frontHeightMm != null && drawer.frontHeightMm > 0) {
      front = Math.round(drawer.frontHeightMm);
    } else if (carcassHeight != null && carcassHeight > 0 && allDrawers) {
      front = drawerFrontPanelHeight(drawer, carcassHeight, allDrawers);
    }
    if (front != null) {
      const qty = Math.max(1, drawer.qty);
      const stackMm = qty * front + Math.max(0, qty - 1) * DRAWER_STACK_GAP_MM;
      return round1(gaps.top + stackMm + gaps.bottom + gapToDoor);
    }
  }

  return round1(gaps.top + drawer.boxHeight + gaps.bottom + gapToDoor);
}

/** Set opening row height from front stack + gaps (+ gap to door). Inactive drawers (qty 0) unchanged. */
export function syncDrawerOpeningFromFront(
  drawer: DrawerConfig,
  hasDoorBelow = false,
  carcassHeight?: number,
  allDrawers?: DrawerConfig[],
  customSizes = false,
): DrawerConfig {
  if (!isActiveDrawer(drawer)) return drawer;
  return {
    ...drawer,
    openingHeight: targetDrawerOpeningHeight(drawer, hasDoorBelow, carcassHeight, allDrawers, customSizes),
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

/** True when this unit uses typed front / opening sizes (no auto carcass split). */
export function usesCustomDrawerSizes(unit: Pick<Unit, 'customDrawerSizes'>): boolean {
  return unit.customDrawerSizes === true;
}

/**
 * Finished drawer front panel height for cut list.
 * Custom mode: use typed `frontHeightMm` (fallback to auto if unset).
 * Grain on the front runs top → bottom (vertical) when the board has grain.
 */
export function drawerFrontHeight(
  drawer: DrawerConfig,
  carcassHeight: number,
  allDrawers: DrawerConfig[] = [drawer],
  customSizes = false,
): number {
  if (customSizes && drawer.frontHeightMm != null && drawer.frontHeightMm > 0) {
    return Math.round(drawer.frontHeightMm);
  }
  return drawerFrontPanelHeight(drawer, carcassHeight, allDrawers);
}

/** Seed `frontHeightMm` from the current auto formula (when turning custom on). */
export function seedCustomFrontHeights(
  drawers: DrawerConfig[],
  carcassHeight: number,
): DrawerConfig[] {
  return drawers.map((d) => {
    if (!isActiveDrawer(d)) return d;
    const auto = drawerFrontPanelHeight(d, carcassHeight, drawers);
    return {
      ...d,
      frontHeightMm: d.frontHeightMm != null && d.frontHeightMm > 0 ? Math.round(d.frontHeightMm) : auto,
    };
  });
}

/**
 * Whole-front stack vs carcass height.
 * Sum of active drawer openings + door openings (gap-to-door is already inside drawer opening).
 */
export function frontStackFit(unit: Pick<Unit, 'height' | 'doors' | 'drawers'>): {
  usedMm: number;
  carcassMm: number;
  overflowMm: number;
  fits: boolean;
} {
  const carcassMm = unit.height;
  const drawerMm = activeDrawers(unit.drawers).reduce((sum, d) => sum + d.openingHeight, 0);
  const doorMm = unit.doors.reduce((sum, d) => sum + d.openingHeight, 0);
  const usedMm = round1(drawerMm + doorMm);
  const overflowMm = round1(usedMm - carcassMm);
  return { usedMm, carcassMm, overflowMm, fits: overflowMm <= 0.05 };
}

/** Human warning when custom sizes overflow the carcass (warn only — cut list still runs). */
export function frontStackOverflowWarning(unit: Pick<Unit, 'height' | 'doors' | 'drawers' | 'customDrawerSizes'>): string | null {
  if (!usesCustomDrawerSizes(unit)) return null;
  const fit = frontStackFit(unit);
  if (fit.fits) return null;
  return (
    `Warning: front stack ${fit.usedMm} mm (drawers + doors) is ${fit.overflowMm} mm taller than carcass ${fit.carcassMm} mm. ` +
    `Adjust opening heights, front heights, or gaps so the total fits.`
  );
}

export function drawerFrontCutListSize(
  drawer: DrawerConfig,
  ctx: Pick<Job, 'settings' | 'edgingMaterials' | 'materials'>,
  carcassHeight: number,
  allDrawers: DrawerConfig[] = [drawer],
  customSizes = false,
): { width: number; length: number; finishedWidth: number; finishedHeight: number; sizeNote: string } {
  const finishedWidth = drawerFrontWidth(drawer);
  const finishedHeight = drawerFrontHeight(drawer, carcassHeight, allDrawers, customSizes);
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
  hasDoorBelow: boolean,
  carcassHeight: number,
  allDrawers: DrawerConfig[] = [drawer],
  customSizes = false,
): string {
  if (!isActiveDrawer(drawer)) {
    return 'Qty 0 — no drawer parts on cut list. Door uses full cupboard height.';
  }
  const gaps = resolveDrawerGaps(drawer);
  const stackGaps = resolveDrawerStackGaps(allDrawers);
  const gapToDoor = hasDoorBelow ? resolveGapToDoor(drawer) : 0;
  const finishedWidth = drawerFrontWidth(drawer);
  const finishedHeight = drawerFrontHeight(drawer, carcassHeight, allDrawers, customSizes);
  const boxH = Math.round(Math.max(1, drawer.boxHeight));
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
  const betweenWide = frontQty > 1 ? ` · ${gaps.between} mm between wide fronts` : '';
  const rowPart = hasDoorBelow
    ? `Opening row ${drawer.openingHeight} mm`
    : `Opening row ${drawer.openingHeight} mm`;
  const cutPart = formatPanelCutSizeSummary(panel);
  const totalFronts = perCupboard * frontQty;
  const totalSlots = totalDrawerFrontSlots(allDrawers);
  const qtyPart = frontQty > 1
    ? `${totalFronts} drawer fronts on cut list (${perCupboard} high × ${frontQty} wide) · `
    : `${totalFronts} drawer front${totalFronts === 1 ? '' : 's'} on cut list (${perCupboard} per cupboard) · `;
  const heightFormula = customSizes
    ? `manual front H ${finishedHeight} mm · grain top→bottom`
    : `(H ${carcassHeight} − T${stackGaps.top} − B${stackGaps.bottom} − ${Math.max(0, totalSlots - 1)}×${DRAWER_STACK_GAP_MM} mm) ÷ ${totalSlots} fronts`;
  return (
    `${qtyPart}` +
    `finished ${finishedWidth} × ${finishedHeight} mm · ${heightFormula} · ` +
    `box ${boxH} mm (Box height field) · ` +
    `L${gaps.left} R${gaps.right} mm · ${rowPart}${gapToDoor ? ` + ${gapToDoor} mm to door` : ''}${betweenWide} · ${cutPart}`
  );
}

export function totalActiveDrawerOpeningHeight(unit: Unit): number {
  return activeDrawers(unit.drawers).reduce((sum, d) => sum + d.openingHeight, 0);
}
