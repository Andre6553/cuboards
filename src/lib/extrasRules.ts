import type { BedroomWallExtra, EdgingPattern, Job, Unit } from '../types';
import { resolveFillerMaterial } from './carcassRules';
import type { LongAlong } from './edgingCutSize';
import { extraDrawerCarcassSize } from './extraDrawerCarcass';
import { edgeCountsToPattern } from './kickplateEdging';

export { extraDrawerCarcassSize } from './extraDrawerCarcass';

export function extraPartPrefix(index: number): string {
  return `Extra ${index + 1}`;
}

/** Ensure top panel size/qty exist before cut list (older jobs only had includeTop). */
export function normalizeBedroomWallExtra(extra: BedroomWallExtra, boardThickness: number): BedroomWallExtra {
  const T = Math.max(0, boardThickness);
  const internalW = Math.max(1, Math.round(extra.width) - 2 * T);
  const depthMm = Math.max(1, Math.round(extra.depth));
  return {
    ...extra,
    topQty: Math.max(1, Math.floor(extra.topQty ?? 1)),
    topLength: Math.max(1, Math.round(extra.topLength || internalW)),
    topDepth: Math.max(1, Math.round(extra.topDepth || depthMm)),
    topEdgingPattern: extra.topEdgingPattern ?? '1_long',
  };
}

export function defaultBedroomWallExtra(
  unit: Pick<Unit, 'width' | 'height' | 'depth' | 'carcass'>,
  edgingFallback = '',
): BedroomWallExtra {
  const c = unit.carcass;
  const carcassEdging = c.leftEdgingMaterialId || edgingFallback;
  const boxMat = c.leftMaterialId;
  const shelfMat = c.shelfMaterialId || boxMat;
  const divMat = c.leftMaterialId;
  const fillerMat = c.fillerMaterialId || boxMat;
  return {
    id: crypto.randomUUID(),
    width: Math.round(unit.width),
    height: Math.round(unit.height),
    depth: Math.round(unit.depth),
    boxMaterialId: boxMat,
    shelfMaterialId: shelfMat,
    divisionMaterialId: divMat,
    fillerMaterialId: fillerMat,
    includeTop: false,
    topQty: 1,
    topLength: Math.max(1, Math.round(unit.width) - 32),
    topDepth: Math.round(unit.depth),
    topMaterialId: boxMat,
    topEdgingPattern: '1_long',
    topEdgingMaterialId: carcassEdging,
    sideFillers: false,
    sideFillerWidth: Math.round(unit.carcass.fillerWidth || 50),
    sideFillerHeight: Math.round(unit.height),
    sideFillerQty: 2,
    sideFillerEdgingLongCount: 1,
    sideFillerEdgingShortCount: 0,
    topFillers: false,
    topFillerWidth: Math.round(unit.carcass.fillerWidth || 50),
    topFillerHeight: Math.round(unit.width),
    topFillerQty: 2,
    topFillerEdgingLongCount: 1,
    topFillerEdgingShortCount: 0,
    shelvesEnabled: false,
    shelfQty: 1,
    /** Front run — cut-list length / 1 Long edging. */
    shelfWidth: Math.round(unit.width),
    /** Front to back — cut-list width. */
    shelfHeight: Math.round(unit.depth),
    shelfEdgingPattern: '1_long',
    shelfEdgingMaterialId: unit.carcass.shelfEdgingMaterialId || carcassEdging,
    divisionEnabled: false,
    divisionQty: 1,
    divisionWidth: Math.round(unit.depth),
    divisionHeight: Math.round(unit.height),
    divisionEdgingPattern: '1_long',
    divisionEdgingMaterialId: carcassEdging,
    drawersEnabled: false,
    drawers: [],
    drawerCarcassWidth: Math.round(unit.width),
    drawerCarcassHeight: Math.round(unit.height),
    drawerCarcassDepth: Math.round(unit.depth),
    drawerCarcassQty: 1,
    edgingPattern: '1_long',
    edgingMaterialId: carcassEdging,
    fillerEdgingPattern: '1_long',
    fillerEdgingMaterialId: unit.carcass.fillerEdgingMaterialId || carcassEdging,
  };
}

/** Floor-unit stand-in for drawer calc: uses drawer carcass size, no doors/kickplate/feet. */
export function extraLayoutUnit(unit: Unit, extra: BedroomWallExtra): Unit {
  const box = extra.drawersEnabled ? extraDrawerCarcassSize(extra) : extra;
  return {
    ...unit,
    width: box.width,
    height: box.height,
    depth: box.depth,
    doors: [],
    drawers: extra.drawersEnabled ? extra.drawers : [],
    plinth: undefined,
    extras: [],
  };
}

export interface ExtraBoardCut {
  partName: string;
  width: number;
  length: number;
  qty: number;
  role: 'side' | 'bottom' | 'top' | 'shelf' | 'division' | 'sideFiller' | 'topFiller';
  grainHint: 'vertical' | 'none';
  edgingPattern: EdgingPattern;
  edgingMaterialId: string;
  edgingLong?: 0 | 1 | 2;
  edgingShort?: 0 | 1 | 2;
  longAlong: LongAlong;
  notes: string;
}

function pushCut(cuts: ExtraBoardCut[], cut: ExtraBoardCut) {
  if (cut.qty <= 0 || cut.width <= 0 || cut.length <= 0) return;
  cuts.push(cut);
}

/**
 * Inner carcass / filler / user-sized shelf and division cuts.
 * Does not include drawers (those reuse calcDrawers on extraLayoutUnit).
 */
export function extraBoardCuts(
  extra: BedroomWallExtra,
  index: number,
  thickness: number,
  fillerWidth: number,
): ExtraBoardCut[] {
  const prefix = extraPartPrefix(index);
  const T = Math.max(0, thickness);
  const internalW = Math.max(0, Math.round(extra.width) - 2 * T);
  const boxEdging = extra.edgingPattern ?? '1_long';
  const boxEdgingMat = extra.edgingMaterialId ?? '';
  const cuts: ExtraBoardCut[] = [];

  pushCut(cuts, {
    partName: `${prefix} · Side (left)`,
    width: Math.round(extra.depth),
    length: Math.round(extra.height),
    qty: 1,
    role: 'side',
    grainHint: 'vertical',
    edgingPattern: boxEdging,
    edgingMaterialId: boxEdgingMat,
    longAlong: 'length',
    notes: 'Inner box',
  });
  pushCut(cuts, {
    partName: `${prefix} · Side (right)`,
    width: Math.round(extra.depth),
    length: Math.round(extra.height),
    qty: 1,
    role: 'side',
    grainHint: 'vertical',
    edgingPattern: boxEdging,
    edgingMaterialId: boxEdgingMat,
    longAlong: 'length',
    notes: 'Inner box',
  });
  pushCut(cuts, {
    partName: `${prefix} · Bottom`,
    width: Math.round(extra.depth),
    length: internalW,
    qty: 1,
    role: 'bottom',
    grainHint: 'none',
    edgingPattern: boxEdging,
    edgingMaterialId: boxEdgingMat,
    longAlong: 'length',
    notes: 'Inner box',
  });
  if (extra.includeTop) {
    const topQty = Math.max(1, Math.round(extra.topQty ?? 1));
    const topLength = Math.max(1, Math.round(extra.topLength || internalW));
    const topDepth = Math.max(1, Math.round(extra.topDepth || extra.depth));
    pushCut(cuts, {
      partName: `${prefix} · Top`,
      width: topDepth,
      length: topLength,
      qty: topQty,
      role: 'top',
      grainHint: 'none',
      edgingPattern: extra.topEdgingPattern ?? '1_long',
      edgingMaterialId: extra.topEdgingMaterialId ?? '',
      longAlong: 'length',
      notes: 'User size · length = front run',
    });
  }

  const fallbackW = Math.max(0, Math.round(fillerWidth));
  if (extra.sideFillers) {
    const sideW = Math.round(extra.sideFillerWidth || fallbackW);
    const sideH = Math.round(extra.sideFillerHeight || extra.height);
    const sideQty = Math.max(0, Math.round(extra.sideFillerQty ?? 2));
    const sideLong = extra.sideFillerEdgingLongCount ?? 1;
    const sideShort = extra.sideFillerEdgingShortCount ?? 0;
    pushCut(cuts, {
      partName: `${prefix} · Side filler`,
      width: sideW,
      length: sideH,
      qty: sideQty,
      role: 'sideFiller',
      grainHint: 'none',
      edgingPattern: edgeCountsToPattern(sideLong, sideShort),
      edgingMaterialId: extra.fillerEdgingMaterialId ?? '',
      longAlong: 'length',
      notes: 'Inner · length = long edge',
    });
  }
  if (extra.topFillers) {
    const topW = Math.round(extra.topFillerWidth || fallbackW);
    const topH = Math.round(extra.topFillerHeight || extra.width);
    const topQty = Math.max(0, Math.round(extra.topFillerQty ?? 2));
    const topLong = extra.topFillerEdgingLongCount ?? 1;
    const topShort = extra.topFillerEdgingShortCount ?? 0;
    pushCut(cuts, {
      partName: `${prefix} · Top filler`,
      width: topW,
      length: topH,
      qty: topQty,
      role: 'topFiller',
      grainHint: 'none',
      edgingPattern: edgeCountsToPattern(topLong, topShort),
      edgingMaterialId: extra.fillerEdgingMaterialId ?? '',
      longAlong: 'length',
      notes: 'Inner · length = long edge',
    });
  }

  if (extra.shelvesEnabled) {
    const qty = Math.max(0, Math.round(extra.shelfQty));
    pushCut(cuts, {
      partName: `${prefix} · Shelf`,
      width: Math.round(extra.shelfHeight),
      length: Math.round(extra.shelfWidth),
      qty,
      role: 'shelf',
      grainHint: 'none',
      edgingPattern: extra.shelfEdgingPattern ?? '1_long',
      edgingMaterialId: extra.shelfEdgingMaterialId ?? '',
      longAlong: 'length',
      notes: 'Length = front / 1 Long edging',
    });
  }

  if (extra.divisionEnabled) {
    const qty = Math.max(0, Math.round(extra.divisionQty));
    pushCut(cuts, {
      partName: `${prefix} · Division panel`,
      width: Math.round(extra.divisionWidth),
      length: Math.round(extra.divisionHeight),
      qty,
      role: 'division',
      grainHint: 'vertical',
      edgingPattern: extra.divisionEdgingPattern ?? '1_long',
      edgingMaterialId: extra.divisionEdgingMaterialId ?? '',
      longAlong: 'length',
      notes: 'User size',
    });
  }

  return cuts;
}

export function extrasSectionEnabled(unit: Pick<Unit, 'extrasEnabled'>): boolean {
  return unit.extrasEnabled === true;
}

export function extrasForCutList(unit: Unit): BedroomWallExtra[] {
  if (!extrasSectionEnabled(unit)) return [];
  if (unit.type !== 'bedroom') return [];
  return unit.extras ?? [];
}

/** Cut-list board material per extra part (not the outer carcass). */
export function extraPartMaterialId(
  extra: BedroomWallExtra,
  unit: Unit,
  job: Job,
  role: ExtraBoardCut['role'],
): string {
  const c = unit.carcass;
  const box = extra.boxMaterialId || c.leftMaterialId;
  switch (role) {
    case 'side':
    case 'bottom':
      return box;
    case 'top':
      return extra.topMaterialId || box;
    case 'shelf':
      return extra.shelfMaterialId || c.shelfMaterialId || box;
    case 'division':
      return extra.divisionMaterialId || c.leftMaterialId;
    case 'sideFiller':
    case 'topFiller':
      return extra.fillerMaterialId || c.fillerMaterialId || resolveFillerMaterial(c, job.materials);
    default:
      return box;
  }
}
