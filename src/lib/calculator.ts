import { defaultPlinth, EDGING_LABELS, isFloorUnit, isKitchenBase } from './constants';
import {
  getHingeByIdForJob,
  getRunnerByIdForJob,
  getRunnerClearancesForJob,
  resolveHingeUnitPrice,
  resolveRunnerUnitPrice,
} from './hardwarePricing';
import { DEFAULT_HINGE_PRESET_ID } from './hingeCatalog';
import { applyCutSizeMode, edgingRunMm, type LongAlong } from './edgingCutSize';
import { doorPanelHeight, doorPanelWidth, DEFAULT_DOOR_GAPS, hingesPerDoorLeaf } from './doorRules';
import { drawerFrontHeight, drawerFrontWidth, DEFAULT_DRAWER_GAPS, DEFAULT_FRONT_OVERHANG_MM, DEFAULT_GAP_TO_DOOR_MM, resolveDrawerBoxMaterialId, resolveDrawerFrontMaterialId, resolveFrontQty, targetDrawerOpeningHeight } from './drawerRules';
import {
  drawerBoxFrontBackWidth,
  drawerBoxFrontBackWidthNote,
  drawerBoxInnerSize,
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
  melamineBackingSize,
  resolveFillerMaterial,
} from './carcassRules';
import { resolveFrontLayout } from './frontLayout';
import { coverageLabel, kickplateRunLengthMm, woodKickplatePieces } from './kickplateRules';
import {
  estimateSheetsFromArea,
  formatSheetCount,
  resolveSheetPurchaseUnit,
  sheetPurchaseDetailLabel,
  sheetPurchaseFraction,
  SHEET_PURCHASE_FRACTION,
} from './sheetCost';
import { calcBoardOffcuts } from './sheetOffcuts';
import { layoutSheets, SAW_KERF_MM } from './sheetLayout';
import { calcJobScrews } from './screwRules';
import { calcJobConnectingFittings } from './connectingFittingRules';
import { calcJobInstall } from './installRules';
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

function roundMm(n: number): number {
  return Math.round(n * 10) / 10;
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
  },
) {
  if (opts.qty <= 0) return;
  const pattern = opts.edgingPattern ?? 'none';
  const longAlong = opts.longAlong ?? 'length';
  const sized = applyCutSizeMode(
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
    unitName: opts.unitName,
    width: roundMm(sized.width),
    length: roundMm(sized.length),
    qty: opts.qty,
    grain: opts.grain,
    notes: joinNotes(opts.notes, sized.sizeNote),
    edgingPattern: pattern,
    edgingMaterialId,
    bottomType: opts.bottomType,
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

  addPiece(
    'Side (left)',
    c.leftMaterialId,
    D,
    H,
    1,
    materialHasGrain(job.materials, c.leftMaterialId) ? 'vertical' : 'none',
    'Grain vertical',
    c.leftVisible ? '1_long' : 'none',
    c.leftEdgingMaterialId,
  );
  if (c.leftVisible) {
    addEdging(edging, job, c.leftMaterialId, 'Side (left)', unit.name, '1_long', D, H, mult, c.leftEdgingMaterialId, 'length');
  }

  addPiece(
    'Side (right)',
    c.rightMaterialId,
    D,
    H,
    1,
    materialHasGrain(job.materials, c.rightMaterialId) ? 'vertical' : 'none',
    'Grain vertical',
    c.rightVisible ? '1_long' : 'none',
    c.rightEdgingMaterialId,
  );
  if (c.rightVisible) {
    addEdging(edging, job, c.rightMaterialId, 'Side (right)', unit.name, '1_long', D, H, mult, c.rightEdgingMaterialId, 'length');
  }

  addEdgedPiece('Bottom', c.bottomMaterialId, D, internalW, 1, 'none', '', '1_long', c.bottomEdgingMaterialId);

  const isWall = c.mountType === 'wall';
  if (isWall) {
    addEdgedPiece('Extra bottom (wall)', c.bottomMaterialId, D, internalW, 1, 'none', 'Wall unit — second bottom panel', '1_long', c.bottomEdgingMaterialId);
  }

  for (let i = 0; i < c.shelfQty; i++) {
    addEdgedPiece(
      `Shelf ${i + 1}`,
      c.shelfMaterialId,
      D,
      internalW,
      1,
      'none',
      '',
      '1_long',
      c.shelfEdgingMaterialId,
    );
  }

  const fillerMatId = resolveFillerMaterial(c, job.materials);
  const fillerNote = fillersFollowSideMaterial(c, job.materials)
    ? 'Matches side material'
    : '';

  const woodenTop = !isWall && c.countertopType === 'wooden';
  if (woodenTop) {
    addEdgedPiece(
      'Top (full)',
      fillerMatId,
      D,
      internalW,
      1,
      'none',
      `Wooden top support · ${fillerNote}`.trim(),
      '1_long',
      c.fillerEdgingMaterialId,
    );
  } else {
    addEdgedPiece('Top filler (front)', fillerMatId, c.fillerWidth, internalW, 1, 'none', fillerNote, '1_long', c.fillerEdgingMaterialId);
    addEdgedPiece('Top filler (back)', fillerMatId, c.fillerWidth, internalW, 1, 'none', fillerNote, '1_long', c.fillerEdgingMaterialId);
  }

  const backingType = c.backingType ?? 'none';
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
      unitName: unit.name,
      width: Math.round(backW * 10) / 10,
      length: Math.round(backH * 10) / 10,
      qty: mult,
      grain: 'none',
      edgingPattern: 'none',
      notes: `${job.masonite.thickness}mm · W−2 × H−2 mm ${mult > 1 ? `· ${mult} cupboards` : ''}`.trim(),
    });
  }
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
  if (!isKitchenBase(unit.type) || !unit.plinth || !isFloorUnit(unit)) return;

  const { width: W, depth: D } = unit;
  const plinth = unit.plinth;
  const kh = plinth.kickplateHeight;
  const kickType = plinth.kickplateType ?? 'wood';
  const coverage = plinth.kickplateCoverage ?? 'front';

  if (kickType === 'wood') {
    for (const kp of woodKickplatePieces(W, D, kh, plinth)) {
      pushBoardPiece(job, pieces, {
        category: 'carcass',
        materialId: plinth.kickplateMaterialId,
        partName: kp.partName,
        unitName: unit.name,
        width: kp.width,
        length: kp.length,
        qty: mult,
        grain: materialHasGrain(job.materials, plinth.kickplateMaterialId) ? 'horizontal' : 'none',
        notes: joinNotes(kp.notes, coverageLabel(coverage)),
        edgingPattern: '1_long',
      });
      addEdging(edging, job, plinth.kickplateMaterialId, kp.partName, unit.name, '1_long', kp.width, kp.length, mult, undefined, 'length');
    }
  } else {
    const runMm = kickplateRunLengthMm(W, D, coverage);
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
      description: 'Plastic adjustable foot',
      qty: footQty,
      unitName: unit.name,
      detail: `${plinth.feetPerUnit}/cupboard · height adjustable`,
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

    pushBoardPiece(job, pieces, {
      category: 'door',
      materialId: door.materialId,
      partName: 'Door',
      unitName: unit.name,
      width: w,
      length: h,
      qty: totalQty,
      grain: materialHasGrain(job.materials, door.materialId) ? 'vertical' : 'none',
      notes: `${door.qty}/cupboard × ${mult} cupboards`,
      edgingPattern: door.edgingPattern,
      edgingMaterialId: door.edgingMaterialId,
      longAlong: 'length',
    });
    addEdging(edging, job, door.materialId, 'Door', unit.name, door.edgingPattern, w, h, totalQty, door.edgingMaterialId, 'length');

    const presetId = door.hinge?.type === 'preset' ? door.hinge.presetId ?? 'gelmar-200' : 'custom';
    const catalogEntry = door.hinge?.type === 'preset' ? getHingeByIdForJob(job, presetId) : undefined;
    const presetName = stripSkuAndPrice(catalogEntry?.shortName ?? catalogEntry?.name ?? 'Custom hinge');
    const priceEach =
      door.hinge?.type === 'custom'
        ? door.hinge.customUnitPrice ?? job.hingePrices.custom ?? 0
        : resolveHingeUnitPrice(job, presetId);
    const finishedH = doorPanelHeight(door);
    const perLeaf = hingesPerDoorLeaf(finishedH);
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
) {
  const T = job.settings.thickness;
  const { width: W, depth: D, drawers } = unit;

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
    const frontClearance = drawer.frontClearance ?? 20;
    const backClearance = drawer.backClearance ?? 5;
    const sideDepth = drawerBoxSideDepth(D, frontClearance, backClearance);
    const boxH = drawer.boxHeight;
    const drawerMult = drawer.qty * mult;
    const frontPieceQty = drawerMult * resolveFrontQty(drawer);
    const facadeW = drawerFrontWidth(drawer);
    const facadeH = drawerFrontHeight(drawer);
    const boxWidthNote = drawerBoxFrontBackWidthNote(W, T, sideClearance);
    const inner = drawerBoxInnerSize(frontBackWidth, sideDepth, T);

    const boxMaterialId = resolveDrawerBoxMaterialId(drawer);
    const frontMaterialId = resolveDrawerFrontMaterialId(drawer);
    const boxFrontBackEdgingPattern = resolveDrawerBoxFrontBackEdgingPattern(drawer);
    const boxSideEdgingPattern = resolveDrawerBoxSideEdgingPattern(drawer);
    const boxEdgingMaterialId = drawer.boxEdgingMaterialId;

    if (facadeW > 0 && facadeH > 0) {
      pushBoardPiece(job, pieces, {
        category: 'drawer',
        materialId: frontMaterialId,
        partName: 'Drawer front',
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
        'Drawer front',
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
      'Drawer box front',
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
      'Drawer box back',
      boxMaterialId,
      frontBackWidth,
      boxH,
      drawerMult,
      boxFrontBackEdgingPattern,
      boxEdgingMaterialId,
      boxWidthNote,
      'width',
    );
    const sideDepthNote = drawerBoxSideDepthNote(D, frontClearance, backClearance);
    pushBoardPiece(job, pieces, {
      category: 'drawer',
      materialId: boxMaterialId,
      partName: 'Drawer side',
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
      'Drawer side',
      unit.name,
      boxSideEdgingPattern,
      sideDepth,
      boxH,
      drawerMult * 2,
      boxEdgingMaterialId,
      'width',
    );

    if (drawer.bottomType === 'solid') {
      if (inner.width > 0 && inner.depth > 0) {
        addDrawerPiece(
          'Drawer bottom (solid)',
          boxMaterialId,
          inner.width,
          inner.depth,
          drawerMult,
          'none',
          undefined,
          'Drop-in solid melamine (no groove)',
          'length',
        );
      }
    } else {
      const bottomMasonite = masonitePanelSize(inner.depth, inner.width);
      pieces.push({
        category: 'drawer',
        materialId: MASONITE_ID,
        materialName: `${job.masonite.name} — ${job.masonite.colour}`,
        partName: 'Drawer bottom (masonite)',
        unitName: unit.name,
        width: Math.round(bottomMasonite.width * 10) / 10,
        length: Math.round(bottomMasonite.length * 10) / 10,
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
    const edgingKey = edgingGroupKey(job, pattern, edgingMaterialId);
    const key = `${p.materialId}|${p.width}|${p.length}|${p.grain}|${edgingKey}`;
    const edgingLabel = formatEdgingLabel(job, pattern, edgingMaterialId);
    const groupKey = `${p.materialName}|${edgingKey}`;
    const existing = map.get(key);
    if (existing) {
      existing.totalQty += p.qty;
    } else {
      map.set(key, {
        materialName: p.materialName,
        width: p.width,
        length: p.length,
        grain: p.grain,
        totalQty: p.qty,
        edgingLabel,
        patternLabel: EDGING_LABELS[pattern] ?? pattern,
        groupKey,
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
  const edgingPart = groupKey.slice(pipe + 1);
  if (edgingPart === 'none') return 'none';
  const segments = edgingPart.split('|');
  if (segments.length < 3) return edgingPart;
  const name = segments.slice(1, -1).join('|');
  const thickness = segments[segments.length - 1];
  return `${name}|${thickness}`;
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
        (a, b) => a.edgingLabel.localeCompare(b.edgingLabel) || b.length - a.length || b.width - a.width,
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

  for (const m of job.materials) {
    const rawAreaMm2 = byMaterial.get(m.id);
    if (!rawAreaMm2) continue;
    const totalAreaMm2 = rawAreaMm2 * wastageFactor;
    const purchaseUnit = resolveSheetPurchaseUnit(m);
    const purchaseFrac = sheetPurchaseFraction(m);
    const purchaseLabel = sheetPurchaseDetailLabel(purchaseUnit);
    let sheetsNeeded = estimateSheetsFromArea(totalAreaMm2, sheetArea, purchaseFrac);
    const wastageNote = wastagePct > 0 ? ` · includes ${wastagePct}% cutting allowance` : '';
    let detail = `${formatSheetCount(sheetsNeeded)} @ ${sheetWidth}×${sheetHeight} (${purchaseLabel}${wastageNote})`;

    if (m.hasGrain) {
      const layout = layoutSheets(
        (piecesByMaterial.get(m.id) ?? []).map((p) => ({
          length: p.length,
          width: p.width,
          qty: p.qty,
          grainLocked: p.grain !== 'none',
          label: `${p.partName} (${p.unitName}) ${p.length} × ${p.width}`,
        })),
        sheetWidth,
        sheetHeight,
        SAW_KERF_MM,
        purchaseFrac,
      );
      const unplacedArea = layout.unplaced.reduce((s, p) => s + p.length * p.width * p.qty, 0);
      sheetsNeeded = Math.max(
        sheetsNeeded,
        layout.sheetsToOrder + estimateSheetsFromArea(unplacedArea, sheetArea, purchaseFrac),
      );
      detail = `${formatSheetCount(sheetsNeeded)} @ ${sheetWidth}×${sheetHeight} · grain layout (${purchaseLabel}; sides, doors & drawer fronts grain top to bottom, ${SAW_KERF_MM} mm saw cut)`;
      for (const p of layout.unplaced) {
        sheetWarnings.push(
          `${m.name}: ${p.label} is longer than the ${Math.max(sheetWidth, sheetHeight)} mm sheet grain — it can't be cut with grain top to bottom.`,
        );
      }
    }

    costs.push({
      category: 'board',
      name: m.name,
      detail,
      quantity: sheetsNeeded,
      unitPrice: m.pricePerSheet,
      subtotal: sheetsNeeded * m.pricePerSheet,
    });
  }

  const masoniteArea = pieces
    .filter((p) => p.materialId === MASONITE_ID)
    .reduce((sum, p) => sum + p.width * p.length * p.qty, 0);
  if (masoniteArea > 0) {
    const mSheetArea = job.masonite.sheetWidth * job.masonite.sheetHeight;
    const masoniteFrac = SHEET_PURCHASE_FRACTION.quarter;
    const sheetsNeeded = estimateSheetsFromArea(masoniteArea, mSheetArea, masoniteFrac);
    costs.push({
      category: 'masonite',
      name: `${job.masonite.name} (${job.masonite.colour})`,
      detail: `${job.masonite.thickness}mm · ${formatSheetCount(sheetsNeeded)} (${sheetPurchaseDetailLabel('quarter')})`,
      quantity: sheetsNeeded,
      unitPrice: job.masonite.pricePerSheet,
      subtotal: sheetsNeeded * job.masonite.pricePerSheet,
    });
  }

  const edgingByMaterial = new Map<string, number>();
  for (const e of edging) {
    edgingByMaterial.set(e.edgingMaterialId, (edgingByMaterial.get(e.edgingMaterialId) ?? 0) + e.totalLm);
  }
  for (const em of job.edgingMaterials) {
    const totalLm = edgingByMaterial.get(em.id);
    if (!totalLm) continue;
    costs.push({
      category: 'edging',
      name: `${em.name} (${em.thickness}mm)`,
      detail: `${totalLm.toFixed(2)} linear metres`,
      quantity: Math.ceil(totalLm * 10) / 10,
      unitPrice: em.pricePerMetre,
      subtotal: totalLm * em.pricePerMetre,
    });
  }

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
    calcKitchenPlinth(layoutUnit, job, pieces, edging, hardware, plasticKickplates, mult);
    calcDoors(layoutUnit, job, pieces, edging, hardware, mult);
    calcDrawers(layoutUnit, job, pieces, edging, hardware, mult);
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
  const materialCosts = calcCosts(job, pieces, edging, hardware, plasticKickplateTotalMetres, screws, sheetWarnings);
  const install = calcJobInstall(job);
  const materialsTotal = materialCosts.reduce((sum, c) => sum + c.subtotal, 0);
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
    install,
    materialsTotal,
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
    frontOverhangMm: DEFAULT_FRONT_OVERHANG_MM,
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
  return { ...base, openingHeight: targetDrawerOpeningHeight(base) };
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
      shelfQty: 1,
      fillerWidth: job.settings.defaultFillerWidth,
      leftVisible: true,
      rightVisible: false,
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
