import type { DoorConfig, DoorGaps, EdgingPattern, Job, Unit } from '../types';
import { DEFAULT_DOOR_GAPS, resolveDoorGaps } from './doorRules';
import { DEFAULT_HINGE_PRESET_ID } from './hingeCatalog';

/** Fixed square panels (bottom / shelf / top) — no edging. */
export const FLOOR_CORNER_PANEL_MM = 884;
/** Side panel depth (short edge). Height = unit.height (user). */
export const FLOOR_CORNER_SIDE_DEPTH_MM = 550;
export const FLOOR_CORNER_DEFAULT_HEIGHT_MM = 780;
/** Fillers: 2 × 748 × 100. */
export const FLOOR_CORNER_FILLER_LENGTH_MM = 748;
export const FLOOR_CORNER_FILLER_WIDTH_MM = 100;
export const FLOOR_CORNER_FILLER_QTY = 2;
/** Masonite backs: 2 × (height × 900). */
export const FLOOR_CORNER_MASONITE_WIDTH_MM = 900;
export const FLOOR_CORNER_MASONITE_QTY = 2;
/** Door leaf widths — L/R gaps do not apply; height = H − top − bottom. */
export const FLOOR_CORNER_DOOR1_WIDTH_MM = 341;
export const FLOOR_CORNER_DOOR2_WIDTH_MM = 325;

export const FLOOR_CORNER_SIDE_EDGING: EdgingPattern = '1_long';
export const FLOOR_CORNER_FILLER_EDGING: EdgingPattern = '1_long';

/** Gaps for floor-corner doors: only top/bottom count (L/R/between forced 0). */
export function floorCornerDoorGaps(gaps?: Partial<DoorGaps>): DoorGaps {
  const base = gaps ? resolveDoorGaps({ gaps: { ...DEFAULT_DOOR_GAPS, ...gaps } } as DoorConfig) : DEFAULT_DOOR_GAPS;
  return {
    left: 0,
    right: 0,
    between: 0,
    top: base.top,
    bottom: base.bottom,
  };
}

export function floorCornerDoorHeightMm(carcassHeightMm: number, gaps?: Partial<DoorGaps>): number {
  const g = floorCornerDoorGaps(gaps);
  return Math.max(1, Math.round(carcassHeightMm) - g.top - g.bottom);
}

export interface FloorCornerSizes {
  panelMm: number;
  sideHeightMm: number;
  sideDepthMm: number;
  fillerLengthMm: number;
  fillerWidthMm: number;
  masoniteHeightMm: number;
  masoniteWidthMm: number;
  door1WidthMm: number;
  door2WidthMm: number;
  doorHeightMm: number;
}

export function calcFloorCornerSizes(unit: Pick<Unit, 'height' | 'doors'>): FloorCornerSizes {
  const sideHeightMm = Math.max(1, Math.round(unit.height));
  const doorGaps = unit.doors[0] ? floorCornerDoorGaps(unit.doors[0].gaps) : floorCornerDoorGaps();
  return {
    panelMm: FLOOR_CORNER_PANEL_MM,
    sideHeightMm,
    sideDepthMm: FLOOR_CORNER_SIDE_DEPTH_MM,
    fillerLengthMm: FLOOR_CORNER_FILLER_LENGTH_MM,
    fillerWidthMm: FLOOR_CORNER_FILLER_WIDTH_MM,
    masoniteHeightMm: sideHeightMm,
    masoniteWidthMm: FLOOR_CORNER_MASONITE_WIDTH_MM,
    door1WidthMm: FLOOR_CORNER_DOOR1_WIDTH_MM,
    door2WidthMm: FLOOR_CORNER_DOOR2_WIDTH_MM,
    doorHeightMm: floorCornerDoorHeightMm(sideHeightMm, doorGaps),
  };
}

function defaultEdgingForMaterial(job: Pick<Job, 'materials' | 'edgingMaterials'>, materialId: string): string {
  const mat = job.materials.find((m) => m.id === materialId);
  return mat?.edgingMaterialId ?? job.edgingMaterials[0]?.id ?? '';
}

function makeCornerDoor(
  job: Pick<Job, 'materials' | 'edgingMaterials' | 'settings'>,
  opts: {
    widthMm: number;
    heightMm: number;
    materialId: string;
    gaps?: DoorGaps;
    edgingPattern?: EdgingPattern;
    edgingMaterialId?: string;
    hinge?: DoorConfig['hinge'];
    factoryHingeHoles?: boolean;
    hingeHoleCount?: number;
    id?: string;
  },
): DoorConfig {
  const materialId = opts.materialId;
  return {
    id: opts.id ?? crypto.randomUUID(),
    qty: 1,
    materialId,
    edgingPattern: opts.edgingPattern ?? '2_long_2_short',
    edgingMaterialId: opts.edgingMaterialId ?? defaultEdgingForMaterial(job, materialId),
    openingWidth: opts.widthMm,
    openingHeight: opts.heightMm,
    gaps: floorCornerDoorGaps(opts.gaps),
    hinge: opts.hinge ?? { type: 'preset', presetId: DEFAULT_HINGE_PRESET_ID },
    factoryHingeHoles: opts.factoryHingeHoles !== false,
    hingeHoleCount: opts.hingeHoleCount,
  };
}

/**
 * When switching to floor corner: lock footprint, default height, one shelf, two fixed-width doors.
 * Preserves door materials/edging/gaps top-bottom when re-applying.
 */
export function applyFloorCornerDefaults(unit: Unit, job: Pick<Job, 'materials' | 'edgingMaterials' | 'settings'>): Unit {
  const height = Math.max(1, unit.height || FLOOR_CORNER_DEFAULT_HEIGHT_MM);
  const defaultMat = unit.carcass.leftMaterialId || job.materials[0]?.id || 'mat-white';
  const doorMat =
    unit.doors[0]?.materialId || unit.doors[1]?.materialId || defaultMat;
  const gaps0 = floorCornerDoorGaps(unit.doors[0]?.gaps);
  const gaps1 = floorCornerDoorGaps(unit.doors[1]?.gaps ?? unit.doors[0]?.gaps);

  const door1 = makeCornerDoor(job, {
    id: unit.doors[0]?.id,
    widthMm: FLOOR_CORNER_DOOR1_WIDTH_MM,
    heightMm: height,
    materialId: unit.doors[0]?.materialId ?? doorMat,
    gaps: gaps0,
    edgingPattern: unit.doors[0]?.edgingPattern,
    edgingMaterialId: unit.doors[0]?.edgingMaterialId,
    hinge: unit.doors[0]?.hinge,
    factoryHingeHoles: unit.doors[0]?.factoryHingeHoles,
    hingeHoleCount: unit.doors[0]?.hingeHoleCount,
  });
  const door2 = makeCornerDoor(job, {
    id: unit.doors[1]?.id,
    widthMm: FLOOR_CORNER_DOOR2_WIDTH_MM,
    heightMm: height,
    materialId: unit.doors[1]?.materialId ?? doorMat,
    gaps: gaps1,
    edgingPattern: unit.doors[1]?.edgingPattern,
    edgingMaterialId: unit.doors[1]?.edgingMaterialId,
    hinge: unit.doors[1]?.hinge,
    factoryHingeHoles: unit.doors[1]?.factoryHingeHoles,
    hingeHoleCount: unit.doors[1]?.hingeHoleCount,
  });

  return {
    ...unit,
    width: FLOOR_CORNER_PANEL_MM,
    depth: FLOOR_CORNER_SIDE_DEPTH_MM,
    height,
    drawers: [],
    doors: [door1, door2],
    carcass: {
      ...unit.carcass,
      mountType: 'floor_corner',
      shelfQty: 1,
      topMaterialId: unit.carcass.topMaterialId || unit.carcass.bottomMaterialId || defaultMat,
      leftEdgingPattern: unit.carcass.leftEdgingPattern ?? FLOOR_CORNER_SIDE_EDGING,
      rightEdgingPattern: unit.carcass.rightEdgingPattern ?? FLOOR_CORNER_SIDE_EDGING,
      fillerEdgingPattern: unit.carcass.fillerEdgingPattern ?? FLOOR_CORNER_FILLER_EDGING,
      backingType: 'masonite',
    },
  };
}

/** Keep door openings / gap L-R locked when height or gaps change. */
export function syncFloorCornerDoors(unit: Unit): Unit {
  if (unit.carcass.mountType !== 'floor_corner') return unit;
  const height = Math.max(1, Math.round(unit.height));
  const doors = unit.doors.slice(0, 2).map((d, i) => ({
    ...d,
    qty: 1,
    openingWidth: i === 0 ? FLOOR_CORNER_DOOR1_WIDTH_MM : FLOOR_CORNER_DOOR2_WIDTH_MM,
    openingHeight: height,
    gaps: floorCornerDoorGaps(d.gaps),
  }));
  while (doors.length < 2) {
    const i = doors.length;
    doors.push({
      id: crypto.randomUUID(),
      qty: 1,
      materialId: doors[0]?.materialId ?? unit.carcass.leftMaterialId,
      edgingPattern: '2_long_2_short',
      edgingMaterialId: doors[0]?.edgingMaterialId ?? unit.carcass.leftEdgingMaterialId,
      openingWidth: i === 0 ? FLOOR_CORNER_DOOR1_WIDTH_MM : FLOOR_CORNER_DOOR2_WIDTH_MM,
      openingHeight: height,
      gaps: floorCornerDoorGaps(doors[0]?.gaps),
      hinge: { type: 'preset', presetId: DEFAULT_HINGE_PRESET_ID },
      factoryHingeHoles: true,
    });
  }
  return {
    ...unit,
    width: FLOOR_CORNER_PANEL_MM,
    depth: FLOOR_CORNER_SIDE_DEPTH_MM,
    height,
    doors,
    drawers: [],
  };
}
