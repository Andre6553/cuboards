import { defaultPlinth, EDGING_LABELS, isSpiceCupboard, plinthHasKickplate, showsKickplate } from './constants';
import { cabinetFootHardwareDescription, cabinetFootHardwareDetail } from './footCatalog';
import { calcSpiceCupboardSizes, defaultSpiceCupboardConfig } from './spiceCupboardRules';
import {
  getHingeByIdForJob,
  getRunnerByIdForJob,
  getRunnerClearancesForJob,
  resolveHingeUnitPrice,
  resolveRunnerUnitPrice,
} from './hardwarePricing';
import { DEFAULT_HINGE_PRESET_ID } from './hingeCatalog';
import { applyCutSizeMode, edgingRunMm, type LongAlong } from './edgingCutSize';
import {
  applyKickplateCutSizeMode,
  edgeCountsToPattern,
  edgingTapeKeyFromMaterial,
  formatKickplateEdgingLabel,
  kickplateEdgingMergeKey,
  kickplateEdgingRunMm,
  kickplateEdgingSummary,
  pieceHasKickplateEdging,
  resolveKickplateEdgingCounts,
  type KickplateEdgingCounts,
} from './kickplateEdging';
import { doorPanelHeight, doorPanelWidth, DEFAULT_DOOR_GAPS, hingesPerDoorLeafForDoor } from './doorRules';
import {
  drawerFrontHeight,
  drawerFrontWidth,
  DEFAULT_DRAWER_GAPS,
  DEFAULT_GAP_TO_DOOR_MM,
  resolveDrawerBoxMaterialId,
  resolveDrawerFrontMaterialId,
  resolveFrontQty,
  targetDrawerOpeningHeight,
} from './drawerRules';
import {
  drawerBoxFrontBackWidth,
  drawerBoxFrontBackWidthNote,
  drawerBoxInnerSize,
  drawerBoxSolidBottomSize,
  drawerBoxSideDepth,
  drawerBoxSideDepthNote,
  stockRunnerLengthMm,
  resolveDrawerBoxFrontBackEdgingPattern,
  resolveDrawerBoxSideEdgingPattern,
} from './drawerBoxRules';
import {
  fillersFollowSideMaterial,
  masoniteBackingSize,
  masonitePanelSize,
  carcassShelfSize,
  melamineBackingSize,
  resolveFillerMaterial,
  topFillerCount,
  bedroomWallFillerPieces,
} from './carcassRules';
import { resolveBedroomWallSideFillerEdging, resolveBedroomWallTopFillerEdging } from './kickplateEdging';
import {
  normalizeVisibleBackPanel,
  resolveVisibleBackPanelEdging,
  resolveVisibleBackPanelMaterialId,
} from './visibleBackPanel';
import { resolveFrontLayout } from './frontLayout';
import { coverageLabel, kickplateRunLengthMm, woodKickplatePieces } from './kickplateRules';
import {
  extraBoardCuts,
  extraLayoutUnit,
  extraPartMaterialId,
  extraPartPrefix,
  extrasForCutList,
  normalizeBedroomWallExtra,
} from './extrasRules';
import { customExtraBoardCuts, customExtrasForCutList } from './customExtrasRules';
import {
  estimateSheetsFromArea,
  formatSheetCount,
  masonitePurchaseFraction,
  resolveMasonitePurchaseUnit,
  resolveSheetPurchaseUnit,
  sheetPurchaseDetailLabel,
  sheetPurchaseFraction,
} from './sheetCost';
import { calcBoardOffcuts } from './sheetOffcuts';
import { calcSheetMaps } from './sheetMaps';
import { layoutSheets, resolveSawKerfMm, type LayoutPiece } from './sheetLayout';
import { cutPiecesToLayout } from './sheetLayoutPieces';
import { calcJobScrews } from './screwRules';
import { calcJobConnectingFittings } from './connectingFittingRules';
import { calcJobInstall } from './installRules';
import {
  appendCutHouseCosts,
  billableEdgingMetres,
  masoniteQuoteSheetCount,
  resolveCutHouseCharges,
} from './cutHouseCharges';
import { boardQuoteStoredUnitPrice } from './boardQuotePricing';
import { splitQuoteCostLines } from './costSummaryGroups';
import { quoteLineSubtotal, quoteUnitPrice } from './vat';
import type {
  ConsolidatedEdging,
  ConsolidatedPiece,
  CostLine,
  CutListGroup,
  CutListResult,
  CutPiece,
  CutPieceCategory,
  DoorConfig,
  DrawerConfig,
  EdgingLine,
  EdgingPattern,
  HardwareItem,
  Job,
  Material,
  PlasticKickplateLine,
  ScrewLine,
  Unit,
} from '../types';

const MASONITE_ID = 'masonite';

function materialName(materials: Material[], id: string): string {
  return materials.find((m) => m.id === id)?.name ?? 'Unknown';
}

function materialHasGrain(materials: Material[], id: string): boolean {
  return materials.find((m) => m.id === id)?.hasGrain ?? false;
}

function edgingLm(
  pattern: EdgingPattern,
  longEdgeMm: number,
  shortEdgeMm: number,
  qty: number,
): number {
  return (edgingRunMm(pattern, longEdgeMm, shortEdgeMm) * qty) / 1000;
}

function longShort(width: number, length: number, longAlong: LongAlong): { longMm: number; shortMm: number } {
  return longAlong === 'width'
    ? { longMm: width, shortMm: length }
    : { longMm: length, shortMm: width };
}

function resolveEdgingMaterialId(job: Job, boardMaterialId: string, override?: string): string {
  if (override) return override;
  const boardMat = job.materials.find((m) => m.id === boardMaterialId);
  return boardMat?.edgingMaterialId ?? '';
}

function formatEdgingLabel(job: Job, pattern: EdgingPattern, edgingMaterialId: string): string {
  if (pattern === 'none') return EDGING_LABELS.none ?? 'No edging';
  const patternLabel = EDGING_LABELS[pattern] ?? pattern;
  const em = job.edgingMaterials.find((e) => e.id === edgingMaterialId);
  if (!em) return patternLabel;
  return `${patternLabel} · ${em.name} (${em.thickness} mm)`;
}

/** Stable key for grouping — same board + pattern + tape spec, even if edging material ids differ per part. */
function edgingGroupKey(job: Job, pattern: EdgingPattern, edgingMaterialId: string): string {
  if (pattern === 'none') return 'none';
  const em = job.edgingMaterials.find((e) => e.id === edgingMaterialId);
  return `${pattern}|${em?.name ?? '—'}|${em?.thickness ?? 0}`;
}

function addEdging(
  lines: EdgingLine[],
  job: Job,
  boardMaterialId: string,
  partName: string,
  unitName: string,
  pattern: EdgingPattern,
  width: number,
  length: number,
  qty: number,
  edgingMaterialIdOverride?: string,
  longAlong: LongAlong = 'length',
) {
  if (pattern === 'none' || qty <= 0) return;
  const { longMm, shortMm } = longShort(width, length, longAlong);
  const totalLm = edgingLm(pattern, longMm, shortMm, qty);
  if (totalLm <= 0) return;

  const boardMat = job.materials.find((m) => m.id === boardMaterialId);
  const edgingMatId = resolveEdgingMaterialId(job, boardMaterialId, edgingMaterialIdOverride);
  const edgingMat = job.edgingMaterials.find((e) => e.id === edgingMatId);

  lines.push({
    boardMaterialName: boardMat?.name ?? 'Unknown',
    edgingMaterialId: edgingMat?.id ?? '',
    edgingMaterialName: edgingMat?.name ?? '—',
    edgingThickness: edgingMat?.thickness ?? 0,
    partName,
    unitName,
    pattern,
    patternLabel: EDGING_LABELS[pattern] ?? pattern,
    edgeSize: `${Math.round(Math.max(width, length))} mm`,
    qty,
    totalLm,
  });
}

function addKickplateEdging(
  lines: EdgingLine[],
  job: Job,
  boardMaterialId: string,
  partName: string,
  unitName: string,
  counts: KickplateEdgingCounts,
  runMm: number,
  heightMm: number,
  qty: number,
  edgingMaterialIdOverride?: string,
) {
  if (qty <= 0 || (counts.long <= 0 && counts.short <= 0)) return;
  const totalLm = (kickplateEdgingRunMm(counts, runMm, heightMm) * qty) / 1000;
  if (totalLm <= 0) return;

  const boardMat = job.materials.find((m) => m.id === boardMaterialId);
  const edgingMatId = resolveEdgingMaterialId(job, boardMaterialId, edgingMaterialIdOverride);
  const edgingMat = job.edgingMaterials.find((e) => e.id === edgingMatId);
  const summary = kickplateEdgingSummary(counts);

  lines.push({
    boardMaterialName: boardMat?.name ?? 'Unknown',
    edgingMaterialId: edgingMat?.id ?? '',
    edgingMaterialName: edgingMat?.name ?? '—',
    edgingThickness: edgingMat?.thickness ?? 0,
    partName,
    unitName,
    pattern: 'none',
    patternLabel: summary,
    edgeSize: `${Math.round(Math.max(runMm, heightMm))} mm`,
    qty,
    totalLm,
  });
}

/** Whole mm — cut house / panel saw (no 0.1 mm on cut lists). */
function roundMm(n: number): number {
  return Math.round(n);
}

/** Catalog short names end with "· SKU 200 · R 6.30"; the hardware table shows those in their own columns. */
function stripSkuAndPrice(shortName: string): string {
  return shortName
    .split(' · ')
    .filter((bit) => !/^SKU\s/i.test(bit) && !/^R\s?\d/.test(bit))
    .join(' · ');
}

function joinNotes(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(' · ');
}

function pushBoardPiece(
  job: Job,
  pieces: CutPiece[],
  opts: {
    category: CutPieceCategory;
    materialId: string;
    partName: string;
    unitId: string;
    unitName: string;
    width: number;
    length: number;
    qty: number;
    grain: CutPiece['grain'];
    notes?: string;
    edgingPattern?: EdgingPattern;
    edgingMaterialId?: string;
    bottomType?: CutPiece['bottomType'];
    longAlong?: LongAlong;
    factoryHingeHoles?: boolean;
    factoryHingeHoleCount?: number;
    kickplateEdgingCounts?: KickplateEdgingCounts;
  },
) {
  if (opts.qty <= 0) return;
  const longAlong = opts.longAlong ?? 'length';
  const kickCounts = opts.kickplateEdgingCounts;
  const pattern =
    kickCounts != null
      ? kickCounts.long <= 0 && kickCounts.short <= 0
        ? 'none'
        : 'none'
      : (opts.edgingPattern ?? 'none');
  const sized =
    kickCounts != null
      ? applyKickplateCutSizeMode(job, opts.materialId, opts.width, opts.length, kickCounts, opts.edgingMaterialId)
      : applyCutSizeMode(
          job,
          opts.materialId,
          opts.width,
          opts.length,
          pattern,
          opts.edgingMaterialId,
          longAlong,
        );
  const edgingMaterialId = resolveEdgingMaterialId(job, opts.materialId, opts.edgingMaterialId);
  pieces.push({
    category: opts.category,
    materialId: opts.materialId,
    materialName: materialName(job.materials, opts.materialId),
    partName: opts.partName,
    unitId: opts.unitId,
    unitName: opts.unitName,
    width: roundMm(sized.width),
    length: roundMm(sized.length),
    qty: opts.qty,
    grain: opts.grain,
    notes: joinNotes(opts.notes, sized.sizeNote),
    edgingPattern: kickCounts != null && kickCounts.long <= 0 && kickCounts.short <= 0 ? 'none' : pattern,
    edgingMaterialId,
    bottomType: opts.bottomType,
    longAlong,
    kickplateEdgingCounts: kickCounts
      ? { long: kickCounts.long as 0 | 1 | 2, short: kickCounts.short as 0 | 1 | 2 }
      : undefined,
    factoryHingeHoles: opts.factoryHingeHoles,
    factoryHingeHoleCount: opts.factoryHingeHoleCount,
  });
}

function calcCarcass(
  unit: Unit,
  job: Job,
  pieces: CutPiece[],
  edging: EdgingLine[],
  mult: number,
) {
  const T = job.settings.thickness;
  const { width: W, height: H, depth: D, carcass: c } = unit;
  const internalW = W - 2 * T;

  const addPiece = (
    partName: string,
    materialId: string,
    w: number,
    l: number,
    qty: number,
    grain: CutPiece['grain'],
    notes = '',
    edgingPattern: EdgingPattern = 'none',
    edgingMaterialId?: string,
    longAlong: LongAlong = 'length',
  ) => {
    const totalQty = qty * mult;
    if (totalQty <= 0) return;
    pushBoardPiece(job, pieces, {
      category: 'carcass',
      materialId,
      partName,
      unitId: unit.id,
      unitName: unit.name,
      width: w,
      length: l,
      qty: totalQty,
      grain,
      notes: mult > 1 ? joinNotes(notes, `${mult} cupboards`) : notes,
      edgingPattern,
      edgingMaterialId,
      longAlong,
    });
  };

  const addEdgedPiece = (
    partName: string,
    materialId: string,
    w: number,
    l: number,
    qty: number,
    grain: CutPiece['grain'],
    notes: string,
    edgingPattern: EdgingPattern,
    edgingMaterialId?: string,
    longAlong: LongAlong = 'length',
  ) => {
    addPiece(partName, materialId, w, l, qty, grain, notes, edgingPattern, edgingMaterialId, longAlong);
    if (edgingPattern !== 'none') {
      addEdging(edging, job, materialId, partName, unit.name, edgingPattern, w, l, qty * mult, edgingMaterialId, longAlong);
    }
  };

  addEdgedPiece(
    'Side (left)',
    c.leftMaterialId,
    D,
    H,
    1,
    materialHasGrain(job.materials, c.leftMaterialId) ? 'vertical' : 'none',
    materialHasGrain(job.materials, c.leftMaterialId) ? 'Grain vertical' : '',
    '1_long',
    c.leftEdgingMaterialId,
  );

  addEdgedPiece(
    'Side (right)',
    c.rightMaterialId,
    D,
    H,
    1,
    materialHasGrain(job.materials, c.rightMaterialId) ? 'vertical' : 'none',
    materialHasGrain(job.materials, c.rightMaterialId) ? 'Grain vertical' : '',
    '1_long',
    c.rightEdgingMaterialId,
  );

  addEdgedPiece('Bottom', c.bottomMaterialId, D, internalW, 1, 'none', '', '1_long', c.bottomEdgingMaterialId);

  const isWall = c.mountType === 'wall';
  if (isWall) {
    addEdgedPiece('Extra bottom (wall)', c.bottomMaterialId, D, internalW, 1, 'none', 'Wall unit — second bottom panel', '1_long', c.bottomEdgingMaterialId);
  }

  const shelfCount = isSpiceCupboard(unit) ? 0 : c.shelfQty;
  const backingType = c.backingType ?? 'none';
  const { depth: shelfDepth, width: shelfWidth } = carcassShelfSize(D, internalW, T, backingType);
  const shelfNote = backingType === 'melamine' ? `D−${T} · solid melamine back` : '';
  for (let i = 0; i < shelfCount; i++) {
    addEdgedPiece(
      `Shelf ${i + 1}`,
      c.shelfMaterialId,
      shelfDepth,
      shelfWidth,
      1,
      'none',
      shelfNote,
      '1_long',
      c.shelfEdgingMaterialId,
    );
  }

  const fillerMatId = resolveFillerMaterial(c, job.materials);
  const fillerNote = fillersFollowSideMaterial(c, job.materials)
    ? 'Matches side material'
    : '';

  const fillerCount = topFillerCount(unit);
  if (fillerCount >= 2) {
    addEdgedPiece('Top filler (front)', fillerMatId, c.fillerWidth, internalW, 1, 'none', fillerNote, '1_long', c.fillerEdgingMaterialId);
    addEdgedPiece('Top filler (back)', fillerMatId, c.fillerWidth, internalW, 1, 'none', fillerNote, '1_long', c.fillerEdgingMaterialId);
  }
  if (fillerCount >= 3) {
    addEdgedPiece('Top filler (centre)', fillerMatId, c.fillerWidth, internalW, 1, 'none', fillerNote, '1_long', c.fillerEdgingMaterialId);
  }

  const bedroomFillers = bedroomWallFillerPieces(unit);
  if (bedroomFillers.side) {
    const { width: fw, length: sideH, qty: sideQty } = bedroomFillers.side;
    const sideCounts = resolveBedroomWallSideFillerEdging(c);
    const totalQty = sideQty * mult;
    if (totalQty > 0) {
      pushBoardPiece(job, pieces, {
        category: 'carcass',
        materialId: fillerMatId,
        partName: 'Side filler',
        unitId: unit.id,
      unitName: unit.name,
        width: fw,
        length: sideH,
        qty: totalQty,
        grain: 'none',
        notes: joinNotes('Bedroom wall · user size', fillerNote, mult > 1 ? `${mult} cupboards` : undefined),
        edgingPattern: edgeCountsToPattern(sideCounts.long, sideCounts.short),
        edgingMaterialId: c.fillerEdgingMaterialId,
        longAlong: 'length',
      });
      addEdging(
        edging,
        job,
        fillerMatId,
        'Side filler',
        unit.name,
        edgeCountsToPattern(sideCounts.long, sideCounts.short),
        fw,
        sideH,
        totalQty,
        c.fillerEdgingMaterialId,
        'length',
      );
    }
  }
  if (bedroomFillers.top) {
    const { width: fw, length: topW, qty: topQty } = bedroomFillers.top;
    const topCounts = resolveBedroomWallTopFillerEdging(c);
    const totalQty = topQty * mult;
    if (totalQty > 0) {
      pushBoardPiece(job, pieces, {
        category: 'carcass',
        materialId: fillerMatId,
        partName: 'Top filler',
        unitId: unit.id,
      unitName: unit.name,
        width: fw,
        length: topW,
        qty: totalQty,
        grain: 'none',
        notes: joinNotes('Bedroom wall · user size', fillerNote, mult > 1 ? `${mult} cupboards` : undefined),
        edgingPattern: edgeCountsToPattern(topCounts.long, topCounts.short),
        edgingMaterialId: c.fillerEdgingMaterialId,
        longAlong: 'length',
      });
      addEdging(
        edging,
        job,
        fillerMatId,
        'Top filler',
        unit.name,
        edgeCountsToPattern(topCounts.long, topCounts.short),
        fw,
        topW,
        totalQty,
        c.fillerEdgingMaterialId,
        'length',
      );
    }
  }

  if (backingType === 'melamine') {
    const backMatId = c.backingMaterialId || c.bottomMaterialId;
    const { width: backW, height: backH } = melamineBackingSize(W, H, T);
    addPiece(
      'Carcass back (melamine)',
      backMatId,
      backW,
      backH,
      1,
      'none',
      `Inside carcass · W−2×${T} × H−${T} mm`,
    );
  } else if (backingType === 'masonite') {
    const { width: backW, height: backH } = masoniteBackingSize(W, H);
    pieces.push({
      category: 'carcass',
      materialId: MASONITE_ID,
      materialName: `${job.masonite.name} — ${job.masonite.colour}`,
      partName: 'Carcass back (masonite)',
      unitId: unit.id,
      unitName: unit.name,
      width: Math.round(backW),
      length: Math.round(backH),
      qty: mult,
      grain: 'none',
      edgingPattern: 'none',
      notes: `${job.masonite.thickness}mm · W−2 × H−2 mm ${mult > 1 ? `· ${mult} cupboards` : ''}`.trim(),
    });
  }

  const visibleBack = normalizeVisibleBackPanel(unit, c);
  if (backingType === 'none' && visibleBack?.enabled) {
    const panelW = Math.max(1, roundMm(visibleBack.widthMm));
    const panelH = Math.max(1, roundMm(visibleBack.heightMm));
    const backMatId = resolveVisibleBackPanelMaterialId(unit, job.materials);
    const edging = resolveVisibleBackPanelEdging(unit, backMatId, job.materials);
    addEdgedPiece(
      'Visible back panel',
      backMatId,
      panelW,
      panelH,
      1,
      materialHasGrain(job.materials, backMatId) ? 'vertical' : 'none',
      'External back · no carcass backing',
      edging.pattern,
      edging.edgingMaterialId,
      'length',
    );
  }
}

function calcSpiceCupboard(
  unit: Unit,
  job: Job,
  pieces: CutPiece[],
  edging: EdgingLine[],
  mult: number,
) {
  if (!isSpiceCupboard(unit)) return;

  const T = job.settings.thickness;
  const { width: W, height: H, depth: D, carcass: c } = unit;
  const spiceConfig = unit.spice ?? defaultSpiceCupboardConfig(H);
  const sizes = calcSpiceCupboardSizes(W, H, D, T, spiceConfig);
  const matId = c.shelfMaterialId;
  const edgingMatId = c.shelfEdgingMaterialId;
  const fillerMatId = resolveFillerMaterial(c, job.materials);
  const fillerEdgingMatId = c.fillerEdgingMaterialId;
  const fillerNote = fillersFollowSideMaterial(c, job.materials) ? 'Matches side material' : '';
  const widthNote = `${sizes.frontWidth} = ${W} − 2×${T} − 2×${sizes.runnerSideClearance} runner`;

  const addEdged = (
    partName: string,
    w: number,
    l: number,
    qty: number,
    pattern: EdgingPattern,
    notes: string,
    longAlong: LongAlong = 'length',
    materialId: string = matId,
    edgingMaterialId: string = edgingMatId,
  ) => {
    const totalQty = qty * mult;
    if (totalQty <= 0) return;
    pushBoardPiece(job, pieces, {
      category: 'carcass',
      materialId,
      partName,
      unitId: unit.id,
      unitName: unit.name,
      width: w,
      length: l,
      qty: totalQty,
      grain: 'none',
      notes: mult > 1 ? joinNotes(notes, `${mult} cupboards`) : notes,
      edgingPattern: pattern,
      edgingMaterialId,
      longAlong,
    });
    if (pattern !== 'none') {
      addEdging(edging, job, materialId, partName, unit.name, pattern, w, l, totalQty, edgingMaterialId, longAlong);
    }
  };

  addEdged('Spice front', sizes.frontWidth, sizes.frontHeight, 1, '2_long_1_short', widthNote);
  addEdged('Spice back', sizes.frontWidth, sizes.frontHeight, 1, '2_long_1_short', 'Same as spice front');
  addEdged(
    'Spice split (middle)',
    sizes.splitWidth,
    sizes.splitHeight,
    1,
    '1_long',
    `H ${sizes.splitHeight} = spice front − ${T} · depth ${sizes.splitWidth}`,
    'width',
  );
  addEdged('Spice shelf (left)', sizes.shelfDepth, sizes.shelfWidth, 1, '1_long', 'Left of split');
  addEdged('Spice shelf (right)', sizes.shelfDepth, sizes.shelfWidth, 1, '1_long', 'Right of split');
  addEdged(
    'Spice bottom',
    sizes.bottomDepth,
    sizes.bottomWidth,
    1,
    '1_long',
    `Depth ${sizes.bottomDepth} = carcass ${D} − ${T}`,
  );
  addEdged(
    'Spice filler (left)',
    sizes.fillerHeight,
    sizes.fillerWidth,
    1,
    '2_long',
    joinNotes(fillerNote, '100 × spice bottom width · 2 long'),
    'length',
    fillerMatId,
    fillerEdgingMatId,
  );
  addEdged(
    'Spice filler (right)',
    sizes.fillerHeight,
    sizes.fillerWidth,
    1,
    '2_long',
    joinNotes(fillerNote, '100 × spice bottom width · 2 long'),
    'length',
    fillerMatId,
    fillerEdgingMatId,
  );
}

function calcKitchenPlinth(
  unit: Unit,
  job: Job,
  pieces: CutPiece[],
  edging: EdgingLine[],
  hardware: HardwareItem[],
  plasticLines: PlasticKickplateLine[],
  mult: number,
) {
  if (!showsKickplate(unit) || !unit.plinth) return;

  const { width: W, depth: D } = unit;
  const plinth = unit.plinth;
  const kh = plinth.kickplateHeight;
  const kickType = plinth.kickplateType ?? 'wood';
  const coverage = plinth.kickplateCoverage ?? 'front';

  if (plinthHasKickplate(plinth) && kickType === 'wood') {
    const kickCounts = resolveKickplateEdgingCounts(plinth);
    const kickEdgingMatId = plinth.kickplateEdgingMaterialId;
    const hasGrain = materialHasGrain(job.materials, plinth.kickplateMaterialId);
    for (const kp of woodKickplatePieces(W, D, kh, plinth, job.settings)) {
      pushBoardPiece(job, pieces, {
        category: 'carcass',
        materialId: plinth.kickplateMaterialId,
        partName: kp.partName,
        unitId: unit.id,
      unitName: unit.name,
        width: kp.width,
        length: kp.length,
        qty: mult,
        grain: hasGrain ? 'vertical' : 'none',
        notes: joinNotes(kp.notes, coverageLabel(coverage), hasGrain ? 'Grain along height' : undefined),
        longAlong: 'length',
        kickplateEdgingCounts: kickCounts,
        edgingMaterialId: kickEdgingMatId,
      });
      addKickplateEdging(
        edging,
        job,
        plinth.kickplateMaterialId,
        kp.partName,
        unit.name,
        kickCounts,
        kp.width,
        kp.length,
        mult,
        kickEdgingMatId,
      );
    }
  } else if (plinthHasKickplate(plinth) && kickType === 'plastic') {
    const runMm = kickplateRunLengthMm(W, D, coverage, plinth, job.settings);
    const totalMetres = (runMm * mult) / 1000;
    const pk = job.plasticKickplate;
    plasticLines.push({
      unitName: unit.name,
      coverageLabel: coverageLabel(coverage),
      lengthMm: runMm,
      stripHeight: pk.stripHeight,
      stripWidth: pk.stripWidth,
      cupboardQty: mult,
      totalMetres,
      pricePerMetre: pk.pricePerMetre,
      subtotal: totalMetres * pk.pricePerMetre,
    });
    hardware.push({
      description: 'Plastic kickplate strip',
      qty: Math.round(totalMetres * 100) / 100,
      unitName: unit.name,
      detail: `${runMm} mm run × ${mult} cupboard(s) = ${totalMetres.toFixed(2)} m · ${pk.stripHeight}×${pk.stripWidth} mm · ${coverageLabel(coverage)}`,
      pricePerPair: pk.pricePerMetre,
      subtotal: totalMetres * pk.pricePerMetre,
    });
  }

  if (plinth.feetRequired !== false) {
    const footQty = plinth.feetPerUnit * mult;
    const pricePerFoot = job.settings.pricePerFoot;
    hardware.push({
      description: cabinetFootHardwareDescription(),
      qty: footQty,
      unitName: unit.name,
      detail: cabinetFootHardwareDetail(plinth.feetPerUnit),
      pricePerPair: pricePerFoot,
      subtotal: pricePerFoot * footQty,
    });
  }
}

function calcDoors(
  unit: Unit,
  job: Job,
  pieces: CutPiece[],
  edging: EdgingLine[],
  hardware: HardwareItem[],
  mult: number,
) {
  for (const door of unit.doors) {
    const w = doorPanelWidth(door);
    const h = doorPanelHeight(door);
    const totalQty = door.qty * mult;
    if (totalQty <= 0 || w <= 0 || h <= 0) continue;

    const finishedH = h;
    const perLeaf = hingesPerDoorLeafForDoor(door);
    const drillHoles = door.factoryHingeHoles !== false;

    pushBoardPiece(job, pieces, {
      category: 'door',
      materialId: door.materialId,
      partName: 'Door',
      unitId: unit.id,
      unitName: unit.name,
      width: w,
      length: h,
      qty: totalQty,
      grain: materialHasGrain(job.materials, door.materialId) ? 'vertical' : 'none',
      notes: `${door.qty}/cupboard × ${mult} cupboards`,
      edgingPattern: door.edgingPattern,
      edgingMaterialId: door.edgingMaterialId,
      longAlong: 'length',
      factoryHingeHoles: drillHoles,
      factoryHingeHoleCount: drillHoles ? perLeaf : undefined,
    });
    addEdging(edging, job, door.materialId, 'Door', unit.name, door.edgingPattern, w, h, totalQty, door.edgingMaterialId, 'length');

    const presetId = door.hinge?.type === 'preset' ? door.hinge.presetId ?? 'gelmar-200' : 'custom';
    const catalogEntry = door.hinge?.type === 'preset' ? getHingeByIdForJob(job, presetId) : undefined;
    const presetName = stripSkuAndPrice(catalogEntry?.shortName ?? catalogEntry?.name ?? 'Custom hinge');
    const priceEach =
      door.hinge?.type === 'custom'
        ? door.hinge.customUnitPrice ?? job.hingePrices.custom ?? 0
        : resolveHingeUnitPrice(job, presetId);
    const hingeQty = door.qty * perLeaf * mult;
    const skuNote = catalogEntry?.sku ? ` · SKU ${catalogEntry.sku}` : '';
    hardware.push({
      description: 'Cabinet hinge',
      qty: hingeQty,
      unitName: unit.name,
      detail: `${presetName} · ${perLeaf}/door @ ${finishedH} mm H${skuNote}`,
      pricePerPair: priceEach,
      subtotal: priceEach * hingeQty,
    });
  }
}

function calcDrawers(
  unit: Unit,
  job: Job,
  pieces: CutPiece[],
  edging: EdgingLine[],
  hardware: HardwareItem[],
  mult: number,
  partPrefix = '',
) {
  const T = job.settings.thickness;
  const { width: W, depth: D, drawers } = unit;
  const pname = (name: string) => (partPrefix ? `${partPrefix} · ${name}` : name);

  for (const drawer of drawers) {
    if (drawer.qty <= 0) continue;
    const presetId = drawer.runner.type === 'preset' ? drawer.runner.presetId ?? 'generic-13' : 'custom';
    const runner = getRunnerClearancesForJob(job, drawer.runner);
    const sideClearance = drawer.sideClearance ?? runner.sideClearance;
    const catalogEntry = drawer.runner.type === 'preset' ? getRunnerByIdForJob(job, presetId) : undefined;
    const presetName = stripSkuAndPrice(
      catalogEntry?.shortName ?? catalogEntry?.name ?? (drawer.runner.type === 'preset' ? 'Runner' : 'Custom runner'),
    );

    const frontBackWidth = drawerBoxFrontBackWidth(W, T, sideClearance);
    const backClearance = drawer.backClearance ?? 5;
    const sideDepth = drawerBoxSideDepth(D, backClearance, T);
    const boxH = Math.round(Math.max(1, drawer.boxHeight));
    const drawerMult = drawer.qty * mult;
    const frontPieceQty = drawerMult * resolveFrontQty(drawer);
    const facadeW = drawerFrontWidth(drawer);
    const facadeH = drawerFrontHeight(drawer, unit.height, drawers);
    const boxWidthNote = drawerBoxFrontBackWidthNote(W, T, sideClearance);
    const inner = drawerBoxInnerSize(frontBackWidth, sideDepth, T);
    const solidBottom = drawerBoxSolidBottomSize(frontBackWidth, sideDepth, T);

    const boxMaterialId = resolveDrawerBoxMaterialId(drawer);
    const frontMaterialId = resolveDrawerFrontMaterialId(drawer);
    const boxFrontBackEdgingPattern = resolveDrawerBoxFrontBackEdgingPattern(drawer);
    const boxSideEdgingPattern = resolveDrawerBoxSideEdgingPattern(drawer);
    const boxEdgingMaterialId = drawer.boxEdgingMaterialId;

    if (facadeW > 0 && facadeH > 0) {
      pushBoardPiece(job, pieces, {
        category: 'drawer',
        materialId: frontMaterialId,
        partName: pname('Drawer front'),
        unitId: unit.id,
      unitName: unit.name,
        width: facadeW,
        length: facadeH,
        qty: frontPieceQty,
        grain: materialHasGrain(job.materials, frontMaterialId) ? 'vertical' : 'none',
        notes: `Visible front · ${drawer.qty}/cupboard × ${mult} cupboards`,
        edgingPattern: drawer.frontEdgingPattern,
        edgingMaterialId: drawer.frontEdgingMaterialId,
        longAlong: 'length',
      });
      addEdging(
        edging,
        job,
        frontMaterialId,
        pname('Drawer front'),
        unit.name,
        drawer.frontEdgingPattern,
        facadeW,
        facadeH,
        frontPieceQty,
        drawer.frontEdgingMaterialId,
        'length',
      );
    }

    const addDrawerPiece = (
      partName: string,
      materialId: string,
      w: number,
      l: number,
      pieceQty: number,
      edgingPattern: EdgingPattern,
      edgingMaterialId?: string,
      sizeNote?: string,
      longAlong: LongAlong = 'width',
    ) => {
      if (pieceQty <= 0) return;
      pushBoardPiece(job, pieces, {
        category: 'drawer',
        materialId,
        partName,
        unitId: unit.id,
      unitName: unit.name,
        width: w,
        length: l,
        qty: pieceQty,
        grain: 'none',
        notes: joinNotes(`${drawer.qty}/cupboard × ${mult} cupboards`, sizeNote),
        edgingPattern,
        edgingMaterialId,
        longAlong,
      });
      addEdging(edging, job, materialId, partName, unit.name, edgingPattern, w, l, pieceQty, edgingMaterialId, longAlong);
    };

    addDrawerPiece(
      pname('Drawer box front'),
      boxMaterialId,
      frontBackWidth,
      boxH,
      drawerMult,
      boxFrontBackEdgingPattern,
      boxEdgingMaterialId,
      boxWidthNote,
      'width',
    );
    addDrawerPiece(
      pname('Drawer box back'),
      boxMaterialId,
      frontBackWidth,
      boxH,
      drawerMult,
      boxFrontBackEdgingPattern,
      boxEdgingMaterialId,
      boxWidthNote,
      'width',
    );
    const sideDepthNote = drawerBoxSideDepthNote(D, backClearance, T);
    pushBoardPiece(job, pieces, {
      category: 'drawer',
      materialId: boxMaterialId,
      partName: pname('Drawer side'),
      unitId: unit.id,
      unitName: unit.name,
      width: sideDepth,
      length: boxH,
      qty: drawerMult * 2,
      grain: 'none',
      notes: joinNotes(`2/cupboard × ${drawer.qty} drawers × ${mult} cupboards`, sideDepthNote),
      edgingPattern: boxSideEdgingPattern,
      edgingMaterialId: boxEdgingMaterialId,
      longAlong: 'width',
    });
    addEdging(
      edging,
      job,
      boxMaterialId,
      pname('Drawer side'),
      unit.name,
      boxSideEdgingPattern,
      sideDepth,
      boxH,
      drawerMult * 2,
      boxEdgingMaterialId,
      'width',
    );

    if (drawer.bottomType === 'solid') {
      if (solidBottom.width > 0 && solidBottom.depth > 0) {
        addDrawerPiece(
          pname('Drawer bottom (solid)'),
          boxMaterialId,
          solidBottom.depth,
          solidBottom.width,
          drawerMult,
          'none',
          undefined,
          'Drop-in solid melamine — same depth as drawer side',
          'width',
        );
      }
    } else {
      const bottomMasonite = masonitePanelSize(inner.depth, inner.width);
      pieces.push({
        category: 'drawer',
        materialId: MASONITE_ID,
        materialName: `${job.masonite.name} — ${job.masonite.colour}`,
        partName: pname('Drawer bottom (masonite)'),
        unitId: unit.id,
      unitName: unit.name,
        width: Math.round(bottomMasonite.width),
        length: Math.round(bottomMasonite.length),
        qty: drawerMult,
        grain: 'none',
        edgingPattern: 'none',
        bottomType: 'masonite',
        notes: `${job.masonite.thickness}mm · drop-in (no groove) · inner −2 mm`,
      });
    }

    const runnerLength =
      'fixedLengthMm' in runner && runner.fixedLengthMm != null
        ? runner.fixedLengthMm
        : stockRunnerLengthMm(D, runner.runnerLengthOffset);
    const pricePerPair =
      drawer.runner.type === 'custom'
        ? job.runnerPrices.custom ?? 0
        : resolveRunnerUnitPrice(job, presetId);
    const skuNote = catalogEntry?.sku ? ` · SKU ${catalogEntry.sku}` : '';
    hardware.push({
      description: 'Drawer runner pair',
      qty: drawerMult,
      unitName: unit.name,
      detail: `${presetName} — ${runnerLength} mm length${skuNote}`,
      pricePerPair,
      subtotal: pricePerPair * drawerMult,
    });
  }
}

/** Stale HMR used extraCutMaterialId(unit, job, cut). Current code passes (extra, unit, job, role). */
function extraCutMaterialId(
  extraOrUnit: Parameters<typeof extraPartMaterialId>[0] | Unit,
  unitOrJob: Parameters<typeof extraPartMaterialId>[1] | Job,
  jobOrCut: Parameters<typeof extraPartMaterialId>[2] | { role: Parameters<typeof extraPartMaterialId>[3] },
  role?: Parameters<typeof extraPartMaterialId>[3],
): string {
  if (role) {
    return extraPartMaterialId(
      extraOrUnit as Parameters<typeof extraPartMaterialId>[0],
      unitOrJob as Parameters<typeof extraPartMaterialId>[1],
      jobOrCut as Parameters<typeof extraPartMaterialId>[2],
      role,
    );
  }
  const unit = extraOrUnit as Unit;
  const job = unitOrJob as Job;
  const cut = jobOrCut as { role: Parameters<typeof extraPartMaterialId>[3] };
  const extra = extrasForCutList(unit)[0];
  if (extra) return extraPartMaterialId(extra, unit, job, cut.role);
  return unit.carcass.leftMaterialId;
}

function calcCustomExtras(
  unit: Unit,
  job: Job,
  pieces: CutPiece[],
  edging: EdgingLine[],
  mult: number,
) {
  const parts = customExtrasForCutList(unit);
  if (parts.length === 0) return;
  for (const cut of customExtraBoardCuts(parts)) {
    const totalQty = cut.qty * mult;
    if (totalQty <= 0) continue;
    const materialId = cut.materialId || unit.carcass.leftMaterialId;
    const grain =
      cut.grainHint === 'vertical' && materialHasGrain(job.materials, materialId) ? 'vertical' : 'none';
    const category = cut.kind === 'door' ? 'door' : 'carcass';
    pushBoardPiece(job, pieces, {
      category,
      materialId,
      partName: cut.partName,
      unitId: unit.id,
      unitName: unit.name,
      width: cut.width,
      length: cut.length,
      qty: totalQty,
      grain,
      notes: joinNotes('Extras · user size', mult > 1 ? `${mult} cupboards` : undefined),
      edgingPattern: cut.edgingPattern,
      edgingMaterialId: cut.edgingMaterialId,
      longAlong: cut.longAlong,
    });
    if (cut.edgingPattern !== 'none') {
      addEdging(
        edging,
        job,
        materialId,
        cut.partName,
        unit.name,
        cut.edgingPattern,
        cut.width,
        cut.length,
        totalQty,
        cut.edgingMaterialId,
        cut.longAlong,
      );
    }
  }
}

function calcBedroomWallExtras(
  unit: Unit,
  job: Job,
  pieces: CutPiece[],
  edging: EdgingLine[],
  hardware: HardwareItem[],
  mult: number,
) {
  const extras = extrasForCutList(unit);
  if (extras.length === 0) return;
  const T = job.settings.thickness;
  const fillerWidth = unit.carcass.fillerWidth ?? 0;

  extras.forEach((rawExtra, i) => {
    const extra = normalizeBedroomWallExtra(rawExtra, T);
    for (const cut of extraBoardCuts(extra, i, T, fillerWidth)) {
      const materialId = extraCutMaterialId(extra, unit, job, cut.role);
      const grain =
        cut.grainHint === 'vertical' && materialHasGrain(job.materials, materialId) ? 'vertical' : 'none';
      const totalQty = cut.qty * mult;
      if (totalQty <= 0) continue;
      const fillerCounts =
        cut.edgingLong != null || cut.edgingShort != null
          ? {
              long: (cut.edgingLong ?? 0) as 0 | 1 | 2,
              short: (cut.edgingShort ?? 0) as 0 | 1 | 2,
            }
          : undefined;
      pushBoardPiece(job, pieces, {
        category: 'carcass',
        materialId,
        partName: cut.partName,
        unitId: unit.id,
      unitName: unit.name,
        width: cut.width,
        length: cut.length,
        qty: totalQty,
        grain,
        notes: joinNotes(cut.notes, grain === 'vertical' ? 'Grain vertical' : undefined, mult > 1 ? `${mult} cupboards` : undefined),
        edgingPattern: fillerCounts ? 'none' : cut.edgingPattern,
        edgingMaterialId: cut.edgingMaterialId,
        longAlong: cut.longAlong,
        kickplateEdgingCounts: fillerCounts,
      });
      if (fillerCounts) {
        addKickplateEdging(
          edging,
          job,
          materialId,
          cut.partName,
          unit.name,
          fillerCounts,
          cut.width,
          cut.length,
          totalQty,
          cut.edgingMaterialId,
        );
      } else if (cut.edgingPattern !== 'none') {
        addEdging(
          edging,
          job,
          materialId,
          cut.partName,
          unit.name,
          cut.edgingPattern,
          cut.width,
          cut.length,
          totalQty,
          cut.edgingMaterialId,
          cut.longAlong,
        );
      }
    }

    const drawerCarcassQty = Math.max(0, Math.floor(extra.drawerCarcassQty ?? 1));
    if (extra.drawersEnabled && drawerCarcassQty > 0 && extra.drawers.some((d) => d.qty > 0)) {
      const inner = resolveFrontLayout(extraLayoutUnit(unit, extra));
      calcDrawers(inner, job, pieces, edging, hardware, mult * drawerCarcassQty, extraPartPrefix(i));
    }
  });
}

/** Combine part labels when the same cut size + edging merges across names (e.g. left/right sides). */
function mergeConsolidatedPartNames(existing: string, incoming: string): string {
  const labels = new Set(
    `${existing} / ${incoming}`
      .split(' / ')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return Array.from(labels).sort((a, b) => a.localeCompare(b)).join(' / ');
}

function consolidatePieces(
  job: Job,
  pieces: CutPiece[],
  categories?: CutPieceCategory | CutPieceCategory[],
): ConsolidatedPiece[] {
  const filtered = categories
    ? pieces.filter((p) =>
        Array.isArray(categories) ? categories.includes(p.category) : p.category === categories,
      )
    : pieces;
  const map = new Map<string, ConsolidatedPiece>();
  for (const p of filtered) {
    const pattern = p.edgingPattern ?? 'none';
    const edgingMaterialId = p.edgingMaterialId ?? resolveEdgingMaterialId(job, p.materialId);
    const mergeEdgingKey = p.kickplateEdgingCounts
      ? kickplateEdgingMergeKey(p.kickplateEdgingCounts, edgingMaterialId)
      : edgingGroupKey(job, pattern, edgingMaterialId);
    const hasEdging = p.kickplateEdgingCounts
      ? pieceHasKickplateEdging(p.kickplateEdgingCounts)
      : pattern !== 'none';
    const tapeKey = hasEdging ? edgingTapeKeyFromMaterial(job, edgingMaterialId) : 'none';
    const key = `${p.materialId}|${p.width}|${p.length}|${p.grain}|${mergeEdgingKey}`;
    const edgingLabel = p.kickplateEdgingCounts
      ? formatKickplateEdgingLabel(job, p.kickplateEdgingCounts, edgingMaterialId)
      : formatEdgingLabel(job, pattern, edgingMaterialId);
    const groupKey = `${p.materialName}|${tapeKey}`;
    const existing = map.get(key);
    if (existing) {
      existing.totalQty += p.qty;
      if (p.partName !== existing.partName) {
        existing.partName = mergeConsolidatedPartNames(existing.partName, p.partName);
      }
    } else {
      map.set(key, {
        partName: p.partName,
        materialName: p.materialName,
        width: p.width,
        length: p.length,
        grain: p.grain,
        totalQty: p.qty,
        edgingLabel,
        patternLabel: p.kickplateEdgingCounts
          ? kickplateEdgingSummary(p.kickplateEdgingCounts)
          : (EDGING_LABELS[pattern] ?? pattern),
        groupKey,
        longAlong: p.longAlong ?? 'length',
      });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      a.groupKey.localeCompare(b.groupKey) ||
      b.length - a.length ||
      b.width - a.width,
  );
}

function edgingTapeKeyFromGroupKey(groupKey: string): string {
  const pipe = groupKey.indexOf('|');
  return groupKey.slice(pipe + 1);
}

function tapeHeading(tapeKey: string): string {
  if (tapeKey === 'none') return 'No edging';
  const pipe = tapeKey.lastIndexOf('|');
  return `${tapeKey.slice(0, pipe)} (${tapeKey.slice(pipe + 1)} mm)`;
}

/**
 * One table per board material + edging tape (name and thickness), covering carcass,
 * doors and drawer parts. The Edging column then only needs the pattern.
 */
function groupBoardCutList(consolidated: ConsolidatedPiece[]): CutListGroup[] {
  const map = new Map<string, { materialName: string; tapeKey: string; items: ConsolidatedPiece[] }>();
  for (const piece of consolidated) {
    const tapeKey = edgingTapeKeyFromGroupKey(piece.groupKey);
    const key = `${piece.materialName}|${tapeKey}`;
    const entry = map.get(key) ?? { materialName: piece.materialName, tapeKey, items: [] };
    entry.items.push({ ...piece, edgingLabel: piece.patternLabel });
    map.set(key, entry);
  }

  return Array.from(map.values())
    .sort((a, b) => {
      const matCmp = a.materialName.localeCompare(b.materialName);
      if (matCmp !== 0) return matCmp;
      if ((a.tapeKey === 'none') !== (b.tapeKey === 'none')) return a.tapeKey === 'none' ? 1 : -1;
      return a.tapeKey.localeCompare(b.tapeKey, undefined, { numeric: true });
    })
    .map(({ materialName, tapeKey, items }) => ({
      heading: `${materialName} — ${tapeHeading(tapeKey)}`,
      items: items.sort(
        (a, b) =>
          a.partName.localeCompare(b.partName) ||
          a.edgingLabel.localeCompare(b.edgingLabel) ||
          b.length - a.length ||
          b.width - a.width,
      ),
    }));
}

function groupConsolidatedPieces(
  consolidated: ConsolidatedPiece[],
  opts?: { includeEdgingInHeading?: boolean },
): CutListGroup[] {
  const includeEdging = opts?.includeEdgingInHeading !== false;
  const map = new Map<string, ConsolidatedPiece[]>();
  for (const piece of consolidated) {
    const list = map.get(piece.groupKey) ?? [];
    list.push(piece);
    map.set(piece.groupKey, list);
  }

  return Array.from(map.values())
    .map((items) => {
      const sorted = [...items].sort((a, b) => b.length - a.length || b.width - a.width);
      const first = sorted[0];
      return {
        heading: includeEdging ? `${first.materialName} — ${first.edgingLabel}` : first.materialName,
        items: sorted,
      };
    })
    .sort((a, b) => a.heading.localeCompare(b.heading));
}

function consolidateEdging(lines: EdgingLine[], edgingMaterials: Job['edgingMaterials']): ConsolidatedEdging[] {
  const map = new Map<string, ConsolidatedEdging>();
  for (const e of lines) {
    const existing = map.get(e.edgingMaterialId);
    if (existing) {
      existing.totalLm += e.totalLm;
    } else {
      const em = edgingMaterials.find((m) => m.id === e.edgingMaterialId);
      map.set(e.edgingMaterialId, {
        edgingMaterialId: e.edgingMaterialId,
        edgingMaterialName: e.edgingMaterialName,
        thickness: e.edgingThickness,
        totalLm: e.totalLm,
        pricePerMetre: em?.pricePerMetre ?? 0,
        subtotal: 0,
      });
    }
  }
  return Array.from(map.values())
    .map((row) => ({
      ...row,
      subtotal: row.totalLm * row.pricePerMetre,
    }))
    .sort((a, b) => a.edgingMaterialName.localeCompare(b.edgingMaterialName) || a.thickness - b.thickness);
}

function pushUnplacedSheetWarnings(
  materialLabel: string,
  sheetWidth: number,
  sheetHeight: number,
  unplaced: LayoutPiece[],
  sheetWarnings: string[],
): void {
  const grainLen = Math.max(sheetWidth, sheetHeight);
  for (const p of unplaced) {
    sheetWarnings.push(
      p.grainLocked
        ? `${materialLabel}: ${p.label} is longer than the ${grainLen} mm sheet grain — it can't be cut with grain top to bottom.`
        : `${materialLabel}: ${p.label} is too large for a ${sheetWidth}×${sheetHeight} mm sheet.`,
    );
  }
}

function sheetCountFromNesting(
  matPieces: CutPiece[],
  sheetWidth: number,
  sheetHeight: number,
  sawKerfMm: number,
  purchaseFrac: number,
  sheetArea: number,
): { sheetsFromLayout: number; unplaced: LayoutPiece[] } {
  const layout = layoutSheets(
    cutPiecesToLayout(matPieces),
    sheetWidth,
    sheetHeight,
    sawKerfMm,
    purchaseFrac,
  );
  const unplacedArea = layout.unplaced.reduce(
    (sum, p) => sum + p.length * p.width * p.qty,
    0,
  );
  const sheetsFromLayout =
    layout.sheetsToOrder + estimateSheetsFromArea(unplacedArea, sheetArea, purchaseFrac);
  return { sheetsFromLayout, unplaced: layout.unplaced };
}

function calcCosts(
  job: Job,
  pieces: CutPiece[],
  edging: EdgingLine[],
  hardware: HardwareItem[],
  plasticKickplateTotalMetres: number,
  screws: ScrewLine[],
  sheetWarnings: string[],
): CostLine[] {
  const costs: CostLine[] = [];
  const { sheetWidth, sheetHeight } = job.settings;
  const sheetArea = sheetWidth * sheetHeight;
  const byMaterial = new Map<string, number>();
  const piecesByMaterial = new Map<string, CutPiece[]>();

  for (const piece of pieces) {
    if (piece.materialId === MASONITE_ID) continue;
    const area = piece.width * piece.length * piece.qty;
    byMaterial.set(piece.materialId, (byMaterial.get(piece.materialId) ?? 0) + area);
    const list = piecesByMaterial.get(piece.materialId) ?? [];
    list.push(piece);
    piecesByMaterial.set(piece.materialId, list);
  }

  const wastagePct = Math.max(0, job.settings.boardWastagePercent ?? 0);
  const wastageFactor = 1 + wastagePct / 100;
  const sawKerfMm = resolveSawKerfMm(job.settings);
  const cutHouseCh = resolveCutHouseCharges(job);
  const boardSheetsForCutHouse: { materialId: string; sheets: number }[] = [];
  let masoniteSheetsForCutHouse = 0;

  for (const m of job.materials) {
    const rawAreaMm2 = byMaterial.get(m.id);
    if (!rawAreaMm2) continue;
    const totalAreaMm2 = rawAreaMm2 * wastageFactor;
    const purchaseUnit = resolveSheetPurchaseUnit(m);
    const purchaseFrac = sheetPurchaseFraction(m);
    const purchaseLabel = sheetPurchaseDetailLabel(purchaseUnit);
    let sheetsNeeded = estimateSheetsFromArea(totalAreaMm2, sheetArea, purchaseFrac);
    const wastageNote = wastagePct > 0 ? ` · includes ${wastagePct}% cutting allowance on area` : '';
    const matPieces = piecesByMaterial.get(m.id) ?? [];
    const { sheetsFromLayout, unplaced } = sheetCountFromNesting(
      matPieces,
      sheetWidth,
      sheetHeight,
      sawKerfMm,
      purchaseFrac,
      sheetArea,
    );
    sheetsNeeded = Math.max(sheetsNeeded, sheetsFromLayout);
    const layoutNote = m.hasGrain
      ? `grain layout (${purchaseLabel}; sides, doors & drawer fronts grain top to bottom, ${sawKerfMm} mm saw cut)`
      : `panel layout (${purchaseLabel}; parts can rotate, ${sawKerfMm} mm saw cut)`;
    let detail = `${formatSheetCount(sheetsNeeded)} @ ${sheetWidth}×${sheetHeight} · ${layoutNote}${wastageNote}`;
    pushUnplacedSheetWarnings(m.name, sheetWidth, sheetHeight, unplaced, sheetWarnings);

    boardSheetsForCutHouse.push({ materialId: m.id, sheets: sheetsNeeded });
    const boardStored = boardQuoteStoredUnitPrice(m, job);
    const boardUnit = quoteUnitPrice(boardStored, job.settings);
    costs.push({
      category: 'board',
      name: m.name,
      detail,
      quantity: sheetsNeeded,
      unitPrice: boardUnit,
      subtotal: quoteLineSubtotal(sheetsNeeded, boardStored, job.settings),
    });
  }

  const masonitePieces = pieces.filter((p) => p.materialId === MASONITE_ID);
  const masoniteArea = masonitePieces.reduce((sum, p) => sum + p.width * p.length * p.qty, 0);
  if (masoniteArea > 0) {
    const mW = job.masonite.sheetWidth;
    const mH = job.masonite.sheetHeight;
    const mSheetArea = mW * mH;
    const mPurchaseUnit = resolveMasonitePurchaseUnit(job.masonite);
    const masoniteFrac = masonitePurchaseFraction(job.masonite);
    const masoniteLabel = sheetPurchaseDetailLabel(mPurchaseUnit);
    let sheetsNeeded = estimateSheetsFromArea(masoniteArea, mSheetArea, masoniteFrac);
    const { sheetsFromLayout, unplaced } = sheetCountFromNesting(
      masonitePieces,
      mW,
      mH,
      sawKerfMm,
      masoniteFrac,
      mSheetArea,
    );
    sheetsNeeded = Math.max(sheetsNeeded, sheetsFromLayout);
    masoniteSheetsForCutHouse = sheetsNeeded;
    const masoniteBillSheets =
      cutHouseCh.masoniteOneFullSheetFromCutHouse === true
        ? masoniteQuoteSheetCount(job, sheetsNeeded, cutHouseCh)
        : sheetsNeeded;
    const masoniteDetailBase = `${job.masonite.thickness}mm · ${formatSheetCount(masoniteBillSheets)} @ ${mW}×${mH}`;
    const masoniteLayoutNote =
      masoniteBillSheets !== sheetsNeeded
        ? `${masoniteDetailBase} · cut house bills 1 full sheet (layout uses ${formatSheetCount(sheetsNeeded)})`
        : `${masoniteDetailBase} · panel layout (${masoniteLabel}; ${sawKerfMm} mm saw cut)`;
    pushUnplacedSheetWarnings(
      `${job.masonite.name} (${job.masonite.colour})`,
      mW,
      mH,
      unplaced,
      sheetWarnings,
    );
    const masoniteSheetPrice = quoteUnitPrice(job.masonite.pricePerSheet, job.settings);
    costs.push({
      category: 'masonite',
      name: `${job.masonite.name} (${job.masonite.colour})`,
      detail: `${masoniteLayoutNote} · ${formatSheetCount(masoniteBillSheets)} billed @ ${masoniteSheetPrice}/sheet`,
      quantity: masoniteBillSheets,
      unitPrice: masoniteSheetPrice,
      subtotal: quoteLineSubtotal(masoniteBillSheets, job.masonite.pricePerSheet, job.settings),
    });
  }

  const edgingByMaterial = new Map<string, number>();
  for (const e of edging) {
    edgingByMaterial.set(e.edgingMaterialId, (edgingByMaterial.get(e.edgingMaterialId) ?? 0) + e.totalLm);
  }
  for (const em of job.edgingMaterials) {
    const totalLm = edgingByMaterial.get(em.id);
    if (!totalLm) continue;
    const { billableLm, detail } = billableEdgingMetres(totalLm, cutHouseCh);
    const edgeUnit = quoteUnitPrice(em.pricePerMetre, job.settings);
    costs.push({
      category: 'edging',
      name: `${em.name} (${em.thickness}mm)`,
      detail,
      quantity: Math.ceil(billableLm * 10) / 10,
      unitPrice: edgeUnit,
      subtotal: quoteLineSubtotal(billableLm, em.pricePerMetre, job.settings),
    });
  }

  appendCutHouseCosts(job, costs, boardSheetsForCutHouse, masoniteSheetsForCutHouse);

  // One line per group here — the itemised rows live in the Hardware / Screws & fittings tables.
  const hardwareRows = hardware.filter((h) => h.description !== 'Plastic kickplate strip');
  const hardwareTotal = hardwareRows.reduce((sum, h) => sum + h.subtotal, 0);
  if (hardwareTotal > 0) {
    const byType = new Map<string, number>();
    for (const h of hardwareRows) byType.set(h.description, (byType.get(h.description) ?? 0) + h.qty);
    const summary = Array.from(byType.entries())
      .map(([name, qty]) => `${qty} × ${name.toLowerCase()}`)
      .join(' · ');
    costs.push({
      category: 'hardware',
      name: 'Hardware',
      detail: `${summary} — see Hardware table`,
      quantity: hardwareRows.reduce((sum, h) => sum + h.qty, 0),
      unitPrice: 0,
      subtotal: hardwareTotal,
    });
  }

  const screwsTotal = screws.reduce((sum, s) => sum + s.subtotal, 0);
  if (screwsTotal > 0) {
    const packs = screws.reduce((sum, s) => sum + s.packsNeeded, 0);
    costs.push({
      category: 'hardware',
      name: 'Screws & fittings',
      detail: `${screws.length} item(s) · ${packs} pack(s) — see Screws & fittings table`,
      quantity: packs,
      unitPrice: 0,
      subtotal: screwsTotal,
    });
  }

  if (plasticKickplateTotalMetres > 0) {
    const pk = job.plasticKickplate;
    costs.push({
      category: 'hardware',
      name: pk.name,
      detail: `${plasticKickplateTotalMetres.toFixed(2)} m · ${pk.stripHeight}×${pk.stripWidth} mm @ R${pk.pricePerMetre}/m — see Plastic kickplate table`,
      quantity: Math.round(plasticKickplateTotalMetres * 100) / 100,
      unitPrice: pk.pricePerMetre,
      subtotal: plasticKickplateTotalMetres * pk.pricePerMetre,
    });
  }

  return costs;
}

export function generateCutList(job: Job): CutListResult {
  const pieces: CutPiece[] = [];
  const edging: EdgingLine[] = [];
  const hardware: HardwareItem[] = [];
  const plasticKickplates: PlasticKickplateLine[] = [];

  for (const unit of job.units) {
    const mult = Math.max(0, unit.unitQty ?? 0);
    if (mult <= 0) continue;
    const layoutUnit = resolveFrontLayout(unit);
    calcCarcass(layoutUnit, job, pieces, edging, mult);
    calcSpiceCupboard(layoutUnit, job, pieces, edging, mult);
    calcKitchenPlinth(layoutUnit, job, pieces, edging, hardware, plasticKickplates, mult);
    calcDoors(layoutUnit, job, pieces, edging, hardware, mult);
    calcDrawers(layoutUnit, job, pieces, edging, hardware, mult);
    calcBedroomWallExtras(layoutUnit, job, pieces, edging, hardware, mult);
    calcCustomExtras(layoutUnit, job, pieces, edging, mult);
  }

  const boardPieces = pieces.filter((p) => p.materialId !== MASONITE_ID);
  const masonitePieces = pieces.filter((p) => p.materialId === MASONITE_ID);

  const consolidated = consolidatePieces(job, boardPieces);
  const masoniteConsolidated = consolidatePieces(job, masonitePieces);
  const boardGroups = groupBoardCutList(consolidated);
  const masoniteGroups = groupConsolidatedPieces(masoniteConsolidated, { includeEdgingInHeading: false });
  const consolidatedEdging = consolidateEdging(edging, job.edgingMaterials);
  const plasticKickplateTotalMetres = plasticKickplates.reduce((s, p) => s + p.totalMetres, 0);
  const screws = [...calcJobScrews(job), ...calcJobConnectingFittings(job)];
  const sheetWarnings: string[] = [];
  const boardOffcuts = calcBoardOffcuts(job, pieces);
  const sheetMaps = calcSheetMaps(job, pieces);
  const materialCosts = calcCosts(job, pieces, edging, hardware, plasticKickplateTotalMetres, screws, sheetWarnings);
  const install = calcJobInstall(job);
  const { woodMaterialTotal, hardwareTotal } = splitQuoteCostLines(materialCosts);
  const materialsTotal = woodMaterialTotal + hardwareTotal;
  const installationTotal = install?.installationTotal ?? 0;
  const travelTotal = install?.travelFee ?? 0;
  const grandTotal = materialsTotal + installationTotal + travelTotal;

  return {
    pieces,
    consolidated,
    boardGroups,
    masoniteGroups,
    edging,
    consolidatedEdging,
    hardware,
    screws,
    plasticKickplates,
    plasticKickplateTotalMetres,
    costs: materialCosts,
    sheetWarnings,
    boardOffcuts,
    sheetMaps,
    install,
    materialsTotal,
    woodMaterialTotal,
    hardwareTotal,
    installationTotal,
    travelTotal,
    grandTotal,
  };
}

export function createDefaultDoor(unit: Unit, job: Job, materialId: string): DoorConfig {
  const boardMat = job.materials.find((m) => m.id === materialId);
  return {
    id: crypto.randomUUID(),
    qty: 1,
    materialId,
    edgingPattern: '2_long_2_short',
    edgingMaterialId: boardMat?.edgingMaterialId ?? job.edgingMaterials[0]?.id ?? '',
    openingWidth: unit.width,
    openingHeight: unit.height,
    gaps: { ...DEFAULT_DOOR_GAPS, between: job.settings.defaultGap },
    hinge: { type: 'preset', presetId: DEFAULT_HINGE_PRESET_ID },
    factoryHingeHoles: true,
  };
}

export function createDefaultDrawer(unit: Unit, job: Job, materialId: string): DrawerConfig {
  const boardMat = job.materials.find((m) => m.id === materialId);
  const base: DrawerConfig = {
    id: crypto.randomUUID(),
    qty: 1,
    frontQty: 1,
    boxMaterialId: materialId,
    frontMaterialId: materialId,
    bottomType: 'masonite',
    boxHeight: 120,
    gapToDoorMm: DEFAULT_GAP_TO_DOOR_MM,
    runner: { type: 'preset', presetId: 'blum-tandem' },
    openingWidth: unit.width,
    openingHeight: unit.height,
    gaps: { ...DEFAULT_DRAWER_GAPS, between: job.settings.defaultGap },
    frontEdgingPattern: '2_long_2_short',
    frontEdgingMaterialId: boardMat?.edgingMaterialId ?? job.edgingMaterials[0]?.id ?? '',
    boxEdgingMaterialId: boardMat?.edgingMaterialId ?? job.edgingMaterials[0]?.id ?? '',
    sideClearance: 13,
    frontClearance: 20,
    backClearance: 5,
  };
  return { ...base, openingHeight: targetDrawerOpeningHeight(base, false, unit.height, [base]) };
}

export function createDefaultUnit(job: Job, index: number): Unit {
  const defaultMat = job.materials[0]?.id ?? 'mat-white';
  const visibleMat = job.materials[1]?.id ?? defaultMat;
  return {
    id: crypto.randomUUID(),
    name: `Unit ${index + 1}`,
    type: 'kitchen_base',
    width: 600,
    height: 720,
    depth: 560,
    unitQty: 1,
    carcass: {
      leftMaterialId: visibleMat,
      rightMaterialId: defaultMat,
      leftEdgingMaterialId: job.materials.find((m) => m.id === visibleMat)?.edgingMaterialId ?? job.edgingMaterials[0]?.id ?? '',
      rightEdgingMaterialId: job.materials.find((m) => m.id === defaultMat)?.edgingMaterialId ?? job.edgingMaterials[0]?.id ?? '',
      bottomMaterialId: defaultMat,
      bottomEdgingMaterialId: job.materials.find((m) => m.id === defaultMat)?.edgingMaterialId ?? job.edgingMaterials[0]?.id ?? '',
      shelfMaterialId: defaultMat,
      shelfEdgingMaterialId: job.materials.find((m) => m.id === defaultMat)?.edgingMaterialId ?? job.edgingMaterials[0]?.id ?? '',
      fillerMaterialId: defaultMat,
      fillerEdgingMaterialId: job.materials.find((m) => m.id === defaultMat)?.edgingMaterialId ?? job.edgingMaterials[0]?.id ?? '',
      shelfQty: 0,
      fillerWidth: job.settings.defaultFillerWidth,
      backingType: 'none',
      backingMaterialId: defaultMat,
      countertopType: 'granite',
      mountType: 'floor',
    },
    plinth: defaultPlinth(job, visibleMat),
    doors: [],
    drawers: [],
  };
}
