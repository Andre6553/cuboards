import type { DoorConfig, DoorGaps, EdgingPattern, Job, Unit } from '../types';
import { DEFAULT_HINGE_PRESET_ID } from './hingeCatalog';
import { floorCornerDoorGaps, floorCornerDoorHeightMm } from './floorCornerRules';

/** Fixed square panels (bottom / 2 shelves / top) — no edging. */
export const WALL_CORNER_PANEL_MM = 584;
/** Side panel depth (short edge). Height = unit.height (user). */
export const WALL_CORNER_SIDE_DEPTH_MM = 300;
export const WALL_CORNER_DEFAULT_HEIGHT_MM = 720;
/** Filler 1: 2 × (H − 2T) × width — width default 70, user editable. */
export const WALL_CORNER_FILLER1_WIDTH_DEFAULT_MM = 70;
export const WALL_CORNER_FILLER1_QTY = 2;
/** Filler 2: 2 × 514 × 70 · 1 long. */
export const WALL_CORNER_FILLER2_LENGTH_MM = 514;
export const WALL_CORNER_FILLER2_WIDTH_MM = 70;
export const WALL_CORNER_FILLER2_QTY = 2;
/** Filler 3: 2 × 498 × 70 · 1 long. */
export const WALL_CORNER_FILLER3_LENGTH_MM = 498;
export const WALL_CORNER_FILLER3_WIDTH_MM = 70;
export const WALL_CORNER_FILLER3_QTY = 2;
/** Masonite backs: 2 × (height × 600). */
export const WALL_CORNER_MASONITE_WIDTH_MM = 600;
export const WALL_CORNER_MASONITE_QTY = 2;
/** Door leaf widths — L/R gaps do not apply; height = H − top − bottom. */
export const WALL_CORNER_DOOR1_WIDTH_MM = 291;
export const WALL_CORNER_DOOR2_WIDTH_MM = 275;

export const WALL_CORNER_SIDE_EDGING: EdgingPattern = '1_long';
export const WALL_CORNER_FILLER_EDGING: EdgingPattern = '1_long';

export const wallCornerDoorGaps = floorCornerDoorGaps;
export const wallCornerDoorHeightMm = floorCornerDoorHeightMm;

export function resolveWallCornerFiller1WidthMm(unit: Pick<Unit, 'carcass'>): number {
  const raw = unit.carcass.wallCornerFiller1WidthMm;
  if (raw != null && Number.isFinite(raw) && raw > 0) return Math.round(raw);
  return WALL_CORNER_FILLER1_WIDTH_DEFAULT_MM;
}

export interface WallCornerSizes {
  panelMm: number;
  sideHeightMm: number;
  sideDepthMm: number;
  boardThicknessMm: number;
  filler1LengthMm: number;
  filler1WidthMm: number;
  filler2LengthMm: number;
  filler2WidthMm: number;
  filler3LengthMm: number;
  filler3WidthMm: number;
  masoniteHeightMm: number;
  masoniteWidthMm: number;
  door1WidthMm: number;
  door2WidthMm: number;
  doorHeightMm: number;
}

export function calcWallCornerSizes(
  unit: Pick<Unit, 'height' | 'doors' | 'carcass'>,
  boardThicknessMm: number,
): WallCornerSizes {
  const sideHeightMm = Math.max(1, Math.round(unit.height));
  const T = Math.max(1, Math.round(boardThicknessMm));
  const doorGaps = unit.doors[0] ? wallCornerDoorGaps(unit.doors[0].gaps) : wallCornerDoorGaps();
  return {
    panelMm: WALL_CORNER_PANEL_MM,
    sideHeightMm,
    sideDepthMm: WALL_CORNER_SIDE_DEPTH_MM,
    boardThicknessMm: T,
    filler1LengthMm: Math.max(1, sideHeightMm - 2 * T),
    filler1WidthMm: resolveWallCornerFiller1WidthMm(unit),
    filler2LengthMm: WALL_CORNER_FILLER2_LENGTH_MM,
    filler2WidthMm: WALL_CORNER_FILLER2_WIDTH_MM,
    filler3LengthMm: WALL_CORNER_FILLER3_LENGTH_MM,
    filler3WidthMm: WALL_CORNER_FILLER3_WIDTH_MM,
    masoniteHeightMm: sideHeightMm,
    masoniteWidthMm: WALL_CORNER_MASONITE_WIDTH_MM,
    door1WidthMm: WALL_CORNER_DOOR1_WIDTH_MM,
    door2WidthMm: WALL_CORNER_DOOR2_WIDTH_MM,
    doorHeightMm: wallCornerDoorHeightMm(sideHeightMm, doorGaps),
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
    gaps: wallCornerDoorGaps(opts.gaps),
    hinge: opts.hinge ?? { type: 'preset', presetId: DEFAULT_HINGE_PRESET_ID },
    factoryHingeHoles: opts.factoryHingeHoles !== false,
    hingeHoleCount: opts.hingeHoleCount,
  };
}

/**
 * When switching to wall corner: lock footprint, two shelves, two fixed-width doors, no drawers.
 */
export function applyWallCornerDefaults(unit: Unit, job: Pick<Job, 'materials' | 'edgingMaterials' | 'settings'>): Unit {
  const height = Math.max(1, unit.height || WALL_CORNER_DEFAULT_HEIGHT_MM);
  const defaultMat = unit.carcass.leftMaterialId || job.materials[0]?.id || 'mat-white';
  const doorMat = unit.doors[0]?.materialId || unit.doors[1]?.materialId || defaultMat;
  const gaps0 = wallCornerDoorGaps(unit.doors[0]?.gaps);
  const gaps1 = wallCornerDoorGaps(unit.doors[1]?.gaps ?? unit.doors[0]?.gaps);

  const door1 = makeCornerDoor(job, {
    id: unit.doors[0]?.id,
    widthMm: WALL_CORNER_DOOR1_WIDTH_MM,
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
    widthMm: WALL_CORNER_DOOR2_WIDTH_MM,
    heightMm: height,
    materialId: unit.doors[1]?.materialId ?? doorMat,
    gaps: gaps1,
    edgingPattern: unit.doors[1]?.edgingPattern,
    edgingMaterialId: unit.doors[1]?.edgingMaterialId,
    hinge: unit.doors[1]?.hinge,
    factoryHingeHoles: unit.doors[1]?.factoryHingeHoles,
    hingeHoleCount: unit.doors[1]?.hingeHoleCount,
  });

  const { plinth: _drop, ...rest } = unit;

  return {
    ...rest,
    type: 'wall',
    width: WALL_CORNER_PANEL_MM,
    depth: WALL_CORNER_SIDE_DEPTH_MM,
    height,
    drawers: [],
    doors: [door1, door2],
    carcass: {
      ...unit.carcass,
      mountType: 'wall_corner',
      shelfQty: 2,
      topMaterialId: unit.carcass.topMaterialId || unit.carcass.bottomMaterialId || defaultMat,
      leftEdgingPattern: unit.carcass.leftEdgingPattern ?? WALL_CORNER_SIDE_EDGING,
      rightEdgingPattern: unit.carcass.rightEdgingPattern ?? WALL_CORNER_SIDE_EDGING,
      fillerEdgingPattern: unit.carcass.fillerEdgingPattern ?? WALL_CORNER_FILLER_EDGING,
      wallCornerFiller1WidthMm:
        unit.carcass.wallCornerFiller1WidthMm ?? WALL_CORNER_FILLER1_WIDTH_DEFAULT_MM,
      backingType: 'masonite',
    },
  };
}

/** Keep door openings / gap L-R locked when height or gaps change. */
export function syncWallCornerDoors(unit: Unit): Unit {
  if (unit.carcass.mountType !== 'wall_corner') return unit;
  const height = Math.max(1, Math.round(unit.height));
  const doors = unit.doors.slice(0, 2).map((d, i) => ({
    ...d,
    qty: 1,
    openingWidth: i === 0 ? WALL_CORNER_DOOR1_WIDTH_MM : WALL_CORNER_DOOR2_WIDTH_MM,
    openingHeight: height,
    gaps: wallCornerDoorGaps(d.gaps),
  }));
  while (doors.length < 2) {
    const i = doors.length;
    doors.push({
      id: crypto.randomUUID(),
      qty: 1,
      materialId: doors[0]?.materialId ?? unit.carcass.leftMaterialId,
      edgingPattern: '2_long_2_short',
      edgingMaterialId: doors[0]?.edgingMaterialId ?? unit.carcass.leftEdgingMaterialId,
      openingWidth: i === 0 ? WALL_CORNER_DOOR1_WIDTH_MM : WALL_CORNER_DOOR2_WIDTH_MM,
      openingHeight: height,
      gaps: wallCornerDoorGaps(doors[0]?.gaps),
      hinge: { type: 'preset', presetId: DEFAULT_HINGE_PRESET_ID },
      factoryHingeHoles: true,
    });
  }
  return {
    ...unit,
    width: WALL_CORNER_PANEL_MM,
    depth: WALL_CORNER_SIDE_DEPTH_MM,
    height,
    doors,
    drawers: [],
  };
}
