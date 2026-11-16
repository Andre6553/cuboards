import type { DoorConfig, DoorGaps, Job } from '../types';
import { formatPanelCutSizeSummary, panelCutSizes } from './edgingCutSize';

export const DEFAULT_DOOR_GAPS: DoorGaps = {
  left: 2,
  right: 2,
  top: 10,
  bottom: 0,
  between: 2,
};

/** Pre-2026-11-16 default top/bottom on saved jobs — upgraded on load to {@link DEFAULT_DOOR_GAPS}. */
const LEGACY_DOOR_TOP_BOTTOM_MM = 2;

/** Apply new default top/bottom when a door still has the old 2 / 2 mm top & bottom. */
export function upgradeLegacyDoorGaps(gaps: DoorGaps): DoorGaps {
  const top = Number(gaps.top);
  const bottom = Number(gaps.bottom);
  if (top === LEGACY_DOOR_TOP_BOTTOM_MM && bottom === LEGACY_DOOR_TOP_BOTTOM_MM) {
    return { ...gaps, top: DEFAULT_DOOR_GAPS.top, bottom: DEFAULT_DOOR_GAPS.bottom };
  }
  return gaps;
}

/** @deprecated use DEFAULT_DOOR_GAPS — kept for existing imports */
export const DOOR_SIDE_GAP_MM = DEFAULT_DOOR_GAPS.left;

export function resolveDoorGaps(door: DoorConfig & { gap?: number }): DoorGaps {
  if (door.gaps) return upgradeLegacyDoorGaps(door.gaps);
  const legacy = door.gap ?? DEFAULT_DOOR_GAPS.between;
  return {
    left: DEFAULT_DOOR_GAPS.left,
    right: DEFAULT_DOOR_GAPS.right,
    top: DEFAULT_DOOR_GAPS.top,
    bottom: DEFAULT_DOOR_GAPS.bottom,
    between: legacy,
  };
}

/** Smallest usable door opening zone on the carcass front (gaps + panel allowance). */
export function minDoorOpeningHeight(door: DoorConfig): number {
  const gaps = resolveDoorGaps(door);
  return gaps.top + gaps.bottom + 200;
}

/** Finished door panel width (one leaf) before cut-list edging adjustment. */
export function doorPanelWidth(door: DoorConfig): number {
  const gaps = resolveDoorGaps(door);
  const qty = Math.max(1, door.qty);
  const betweenTotal = (qty - 1) * gaps.between;
  return (door.openingWidth - gaps.left - gaps.right - betweenTotal) / qty;
}

/** Finished door panel height before cut-list edging adjustment. */
export function doorPanelHeight(door: DoorConfig): number {
  const gaps = resolveDoorGaps(door);
  return door.openingHeight - gaps.top - gaps.bottom;
}

/** Finished door height at or under this uses 2 hinge holes; taller doors default to 4. */
export const HINGE_HOLE_HEIGHT_SPLIT_MM = 1200;

/** Choices in the factory hinge-hole dropdown. */
export const HINGE_HOLE_OPTIONS = [2, 3, 4, 5, 6] as const;

/**
 * Default hinge cups per door leaf from finished door height.
 * Under or equal to 1200 mm → 2. Taller → 4.
 */
export function defaultHingeHoles(finishedDoorHeightMm: number): number {
  return finishedDoorHeightMm <= HINGE_HOLE_HEIGHT_SPLIT_MM ? 2 : 4;
}

/** Saved count, or the height default when the user has not picked one. */
export function resolveHingeHoleCount(door: DoorConfig): number {
  const saved = door.hingeHoleCount;
  if (saved != null && Number.isFinite(saved) && saved >= 2 && saved <= 6) {
    return Math.round(saved);
  }
  return defaultHingeHoles(doorPanelHeight(door));
}

export function hingesPerDoorLeafForDoor(door: DoorConfig): number {
  return resolveHingeHoleCount(door);
}

export function doorCutListSize(
  door: DoorConfig,
  ctx: Pick<Job, 'settings' | 'edgingMaterials' | 'materials'>,
): {
  width: number;
  length: number;
  finishedWidth: number;
  finishedHeight: number;
  sizeNote: string;
  cutSizeMode: Job['settings']['cutSizeMode'];
  edgingThickness: number;
} {
  const finishedWidth = doorPanelWidth(door);
  const finishedHeight = doorPanelHeight(door);
  const panel = panelCutSizes(
    ctx as Job,
    door.materialId,
    finishedWidth,
    finishedHeight,
    door.edgingPattern,
    door.edgingMaterialId,
  );
  return {
    width: panel.cutWidth,
    length: panel.cutHeight,
    finishedWidth,
    finishedHeight,
    sizeNote: panel.sizeNote,
    cutSizeMode: panel.cutSizeMode,
    edgingThickness: panel.edgingThickness,
  };
}

export function doorSizeSummary(
  door: DoorConfig,
  ctx: Pick<Job, 'settings' | 'edgingMaterials' | 'materials'>,
): string {
  const gaps = resolveDoorGaps(door);
  const finishedWidth = doorPanelWidth(door);
  const finishedHeight = doorPanelHeight(door);
  const panel = panelCutSizes(
    ctx as Job,
    door.materialId,
    finishedWidth,
    finishedHeight,
    door.edgingPattern,
    door.edgingMaterialId,
  );
  const qty = Math.max(1, door.qty);
  const between = qty > 1 ? ` · ${gaps.between} mm between doors` : '';
  const cutPart = formatPanelCutSizeSummary(panel);
  const hingeCount = resolveHingeHoleCount(door);
  return (
    `${qty} door(s) · Opening ${door.openingWidth} × ${door.openingHeight} mm · ` +
    `Gaps L${gaps.left} R${gaps.right} T${gaps.top} B${gaps.bottom}${between} · ` +
    `${hingeCount} hinges/door (finished H ${finishedHeight} mm) · ${cutPart}`
  );
}
