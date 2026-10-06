import type { DoorConfig, DoorGaps, Job } from '../types';
import { formatPanelCutSizeSummary, panelCutSizes } from './edgingCutSize';

export const DEFAULT_DOOR_GAPS: DoorGaps = {
  left: 2,
  right: 2,
  top: 2,
  bottom: 2,
  between: 2,
};

/** @deprecated use DEFAULT_DOOR_GAPS — kept for existing imports */
export const DOOR_SIDE_GAP_MM = DEFAULT_DOOR_GAPS.left;

export function resolveDoorGaps(door: DoorConfig & { gap?: number }): DoorGaps {
  if (door.gaps) return door.gaps;
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

/** Finished door height (mm) at which hinge count steps up. */
export const HINGE_TIER_2_MAX_MM = 1200;
export const HINGE_TIER_3_MAX_MM = 1500;
export const HINGE_TIER_4_MAX_MM = 2000;

/**
 * Hinges per door leaf from finished door height:
 * ≤1.2 m → 2 · >1.2–1.5 m → 3 · >1.5–2 m → 4 · >2 m → 5.
 */
export function hingesPerDoorLeaf(finishedDoorHeightMm: number): number {
  if (finishedDoorHeightMm <= HINGE_TIER_2_MAX_MM) return 2;
  if (finishedDoorHeightMm <= HINGE_TIER_3_MAX_MM) return 3;
  if (finishedDoorHeightMm <= HINGE_TIER_4_MAX_MM) return 4;
  return 5;
}

export function hingesPerDoorLeafForDoor(door: DoorConfig): number {
  return hingesPerDoorLeaf(doorPanelHeight(door));
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
  const hingeCount = hingesPerDoorLeaf(finishedHeight);
  return (
    `${qty} door(s) · Opening ${door.openingWidth} × ${door.openingHeight} mm · ` +
    `Gaps L${gaps.left} R${gaps.right} T${gaps.top} B${gaps.bottom}${between} · ` +
    `${hingeCount} hinges/door (finished H ${finishedHeight} mm) · ${cutPart}`
  );
}
