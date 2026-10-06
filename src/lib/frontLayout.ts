import type { DoorConfig, DrawerConfig, Unit } from '../types';
import { minDoorOpeningHeight } from './doorRules';
import {
  activeDrawers,
  isActiveDrawer,
  syncDrawerOpeningFromFront,
  targetDrawerOpeningHeight,
} from './drawerRules';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function totalDrawerOpeningHeight(unit: Unit): number {
  return activeDrawers(unit.drawers).reduce((sum, d) => sum + d.openingHeight, 0);
}

export function totalDoorOpeningHeight(unit: Unit): number {
  return unit.doors.reduce((sum, d) => sum + d.openingHeight, 0);
}

/** Minimum front opening for an active drawer row. */
export function minDrawerOpeningHeight(drawer: DrawerConfig, hasDoorBelow = false): number {
  if (!isActiveDrawer(drawer)) return 0;
  return targetDrawerOpeningHeight(drawer, hasDoorBelow);
}

/** Default opening height when adding a new active drawer row. */
export function defaultDrawerOpeningHeight(unit: Unit): number {
  const { height, doors } = unit;
  const existing = activeDrawers(unit.drawers);
  const existingTotal = existing.reduce((sum, d) => sum + d.openingHeight, 0);
  const hasDoor = doors.length > 0;

  const stub: DrawerConfig = {
    id: '',
    qty: 1,
    frontQty: 1,
    boxMaterialId: '',
    frontMaterialId: '',
    bottomType: 'masonite',
    boxHeight: existing[0]?.boxHeight ?? 120,
    frontOverhangMm: existing[0]?.frontOverhangMm ?? 10,
    gapToDoorMm: existing[0]?.gapToDoorMm ?? 2,
    runner: { type: 'preset', presetId: 'blum-tandem' },
    openingWidth: unit.width,
    openingHeight: 0,
    gaps: existing[0]?.gaps ?? { left: 2, right: 2, top: 2, bottom: 2, between: 2 },
    frontEdgingPattern: '2_long_2_short',
    frontEdgingMaterialId: '',
    boxEdgingMaterialId: '',
    sideClearance: 13,
    frontClearance: 20,
    backClearance: 5,
  };

  const typical = targetDrawerOpeningHeight(stub, hasDoor);

  if (hasDoor) {
    const remaining = Math.max(0, height - existingTotal);
    if (remaining <= 0) return round1(Math.min(typical, height * 0.35));
    return round1(Math.min(typical, remaining));
  }

  if (existing.length === 0) return height;

  return round1(height / (existing.length + 1));
}

function scaleDrawerHeights(drawers: DrawerConfig[], targetTotal: number, hasDoorBelow: boolean): DrawerConfig[] {
  const total = drawers.reduce((sum, d) => sum + d.openingHeight, 0);
  if (total <= 0 || drawers.length === 0) return drawers;
  const ratio = targetTotal / total;
  const scaled = drawers.map((d) => ({
    ...d,
    openingHeight: round1(d.openingHeight * ratio),
  }));
  const lastIdx = scaled.length - 1;
  const sumExceptLast = scaled.slice(0, lastIdx).reduce((s, d) => s + d.openingHeight, 0);
  scaled[lastIdx] = {
    ...scaled[lastIdx],
    openingHeight: round1(
      Math.max(minDrawerOpeningHeight(scaled[lastIdx], hasDoorBelow), targetTotal - sumExceptLast),
    ),
  };
  return scaled;
}

function syncActiveDrawerOpenings(drawers: DrawerConfig[], hasDoorBelow: boolean): DrawerConfig[] {
  return drawers.map((d) => (isActiveDrawer(d) ? syncDrawerOpeningFromFront(d, hasDoorBelow) : d));
}

function rebalanceDrawerOnlyStack(
  drawers: DrawerConfig[],
  carcassHeight: number,
  changedDrawerId?: string,
): DrawerConfig[] {
  const active = activeDrawers(drawers);
  if (active.length === 0) return drawers;
  if (active.length === 1) {
    return drawers.map((d) => (d.id === active[0].id ? { ...d, openingHeight: carcassHeight } : d));
  }

  let rows = syncActiveDrawerOpenings(active, false);
  const lastIdx = rows.length - 1;
  const changedIdx = changedDrawerId ? rows.findIndex((d) => d.id === changedDrawerId) : -1;

  if (changedIdx >= 0 && changedIdx !== lastIdx) {
    const used = rows.slice(0, lastIdx).reduce((sum, d) => sum + d.openingHeight, 0);
    rows[lastIdx] = {
      ...rows[lastIdx],
      openingHeight: round1(Math.max(minDrawerOpeningHeight(rows[lastIdx], false), carcassHeight - used)),
    };
  } else if (changedIdx === lastIdx) {
    const total = rows.reduce((sum, d) => sum + d.openingHeight, 0);
    if (total > carcassHeight) {
      rows = scaleDrawerHeights(rows, carcassHeight, false);
    } else if (total < carcassHeight && lastIdx > 0) {
      rows[lastIdx - 1] = {
        ...rows[lastIdx - 1],
        openingHeight: round1(
          Math.max(minDrawerOpeningHeight(rows[lastIdx - 1], false), rows[lastIdx - 1].openingHeight + (carcassHeight - total)),
        ),
      };
    }
  } else {
    const total = rows.reduce((sum, d) => sum + d.openingHeight, 0);
    if (total > carcassHeight) {
      rows = scaleDrawerHeights(rows, carcassHeight, false);
    } else if (total < carcassHeight) {
      const used = rows.slice(0, lastIdx).reduce((sum, d) => sum + d.openingHeight, 0);
      rows[lastIdx] = {
        ...rows[lastIdx],
        openingHeight: round1(Math.max(minDrawerOpeningHeight(rows[lastIdx], false), carcassHeight - used)),
      };
    }
  }

  const byId = new Map(rows.map((d) => [d.id, d]));
  return drawers.map((d) => byId.get(d.id) ?? d);
}

function capDrawersForDoor(
  _unit: Unit,
  drawers: DrawerConfig[],
  doors: DoorConfig[],
  carcassHeight: number,
): DrawerConfig[] {
  const active = activeDrawers(drawers);
  if (active.length === 0 || doors.length === 0) return drawers;

  const minDoorTotal = doors.reduce((sum, d) => sum + minDoorOpeningHeight(d), 0);
  const drawerTotal = active.reduce((sum, d) => sum + d.openingHeight, 0);
  const doorSpace = carcassHeight - drawerTotal;

  if (doorSpace >= minDoorTotal) return drawers;

  const maxDrawerTotal = Math.max(
    active.reduce((sum, d) => sum + minDrawerOpeningHeight(d, true), 0),
    carcassHeight - minDoorTotal,
  );

  let adjustedActive: DrawerConfig[];
  if (active.length === 1) {
    const d = active[0];
    const typical = targetDrawerOpeningHeight(d, true);
    adjustedActive = [
      {
        ...d,
        openingHeight: round1(Math.max(minDrawerOpeningHeight(d, true), Math.min(typical, maxDrawerTotal))),
      },
    ];
  } else {
    adjustedActive = scaleDrawerHeights(active, maxDrawerTotal, true);
  }

  const byId = new Map(adjustedActive.map((d) => [d.id, d]));
  return drawers.map((d) => byId.get(d.id) ?? d);
}

export interface FrontLayoutOptions {
  changedDrawerId?: string;
}

/**
 * Align door & drawer openings with carcass width/height.
 * Only drawers with qty &gt; 0 take space on the front. qty 0 = no drawer cuts, door uses full height.
 */
export function resolveFrontLayout(unit: Unit, opts?: FrontLayoutOptions): Unit {
  const { width, height, doors, drawers } = unit;
  const hasDoor = doors.length > 0;

  let syncedDrawers: DrawerConfig[] = drawers.map((d) => ({
    ...d,
    openingWidth: width,
  }));

  let syncedDoors: DoorConfig[] = doors.map((d) => ({
    ...d,
    openingWidth: width,
  }));

  const active = () => activeDrawers(syncedDrawers);
  const doorCount = syncedDoors.length;

  if (active().length === 0 && doorCount === 0) {
    return { ...unit, doors: syncedDoors, drawers: syncedDrawers };
  }

  syncedDrawers = syncActiveDrawerOpenings(syncedDrawers, hasDoor);

  if (active().length > 0 && doorCount > 0) {
    syncedDrawers = capDrawersForDoor(unit, syncedDrawers, syncedDoors, height);
    syncedDrawers = syncActiveDrawerOpenings(syncedDrawers, true);

    let drawerTotal = active().reduce((sum, d) => sum + d.openingHeight, 0);

    if (drawerTotal > height) {
      const scaled = scaleDrawerHeights(active(), height, true);
      const byId = new Map(scaled.map((d) => [d.id, d]));
      syncedDrawers = syncedDrawers.map((d) => byId.get(d.id) ?? d);
      drawerTotal = active().reduce((sum, d) => sum + d.openingHeight, 0);
    }

    const doorSpace = Math.max(0, round1(height - drawerTotal));

    if (doorCount === 1) {
      syncedDoors = syncedDoors.map((d) => ({ ...d, openingHeight: doorSpace }));
    } else {
      const prevDoorTotal = syncedDoors.reduce((sum, d) => sum + d.openingHeight, 0) || doorSpace;
      syncedDoors = syncedDoors.map((d) => ({
        ...d,
        openingHeight: round1((d.openingHeight / prevDoorTotal) * doorSpace),
      }));
    }
  } else if (active().length > 0) {
    syncedDrawers = rebalanceDrawerOnlyStack(syncedDrawers, height, opts?.changedDrawerId);
  } else if (doorCount > 0) {
    if (doorCount === 1) {
      syncedDoors = syncedDoors.map((d) => ({ ...d, openingHeight: height }));
    } else {
      const prevTotal = syncedDoors.reduce((sum, d) => sum + d.openingHeight, 0) || height;
      syncedDoors = syncedDoors.map((d) => ({
        ...d,
        openingHeight: round1((d.openingHeight / prevTotal) * height),
      }));
    }
  }

  return { ...unit, doors: syncedDoors, drawers: syncedDrawers };
}

export function syncFrontLayoutToUnit(unit: Unit, opts?: FrontLayoutOptions): Unit {
  return resolveFrontLayout(unit, opts);
}

export function maxDrawerOpeningHeight(unit: Unit, drawerId: string): number {
  const drawer = unit.drawers.find((d) => d.id === drawerId);
  if (!drawer || !isActiveDrawer(drawer)) return 0;
  const otherDrawers = activeDrawers(unit.drawers)
    .filter((d) => d.id !== drawerId)
    .reduce((sum, d) => sum + d.openingHeight, 0);
  const minDoorTotal = unit.doors.reduce((sum, d) => sum + minDoorOpeningHeight(d), 0);
  const maxTotal = Math.max(0, unit.height - minDoorTotal);
  return Math.max(minDrawerOpeningHeight(drawer, unit.doors.length > 0), maxTotal - otherDrawers);
}
