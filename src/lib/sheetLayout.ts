
import type { CutPiece } from '../types';

/** Grain always runs along the first size shown on the cut list (Length). */
export function grainLabel(grain: CutPiece['grain']): string {
  if (grain === 'vertical') return 'Top to bottom';
  if (grain === 'horizontal') return 'Along length';
  return '—';
}

/** Default saw blade width between parts on the sheet (overridable per job). */
export const SAW_KERF_MM = 4;

export function resolveSawKerfMm(settings: { sawKerfMm?: number } | undefined): number {
  const raw = settings?.sawKerfMm ?? SAW_KERF_MM;
  if (!Number.isFinite(raw)) return SAW_KERF_MM;
  return Math.max(1, Math.min(25, raw));
}

/** Smallest usable offcut (both dimensions) to list on the cut list. */
export const MIN_OFFCUT_MM = 50;

export interface LayoutPiece {
  /** Along the part's grain when `grainLocked` (e.g. door height). */
  length: number;
  width: number;
  qty: number;
  /** Part must sit with `length` along the sheet grain (sheet's long side) — no rotation. */
  grainLocked: boolean;
  label: string;
}

export interface LayoutOffcut {
  /** 1-based sheet number in the nest for this material. */
  sheetIndex: number;
  /** Shorter usable side (mm). */
  widthMm: number;
  /** Longer usable side (mm). */
  lengthMm: number;
  areaMm2: number;
}

export interface LayoutPlacement {
  x: number;
  y: number;
  widthMm: number;
  heightMm: number;
  label: string;
  grainLocked: boolean;
}

export interface LayoutOffcutRect {
  x: number;
  y: number;
  widthMm: number;
  heightMm: number;
}

export interface LayoutSheetDetail {
  sheetIndex: number;
  /** Grain runs along this axis (mm). */
  grainLengthMm: number;
  crossLengthMm: number;
  placements: LayoutPlacement[];
  /** Usable free rectangles (both sides ≥ MIN_OFFCUT_MM), for diagrams. */
  offcutRects: LayoutOffcutRect[];
}

export interface SheetLayoutResult {
  sheetsUsed: number;
  /** Full sheets + rounded-up fraction of the last sheet (¼ steps). */
  sheetsToOrder: number;
  /** Parts that cannot fit on a sheet in the required grain direction. */
  unplaced: LayoutPiece[];
  /** Leftover rectangles after nesting (not affected by board wastage %). */
  offcuts: LayoutOffcut[];
  /** Per-sheet part positions for visual maps (same nest as offcuts). */
  sheetDetails: LayoutSheetDetail[];
}

interface Item {
  w: number;
  h: number;
  canRotate: boolean;
  label: string;
  grainLocked: boolean;
}

/** One rip strip: full grain length, fixed cross-grain height (panel-saw row). */
interface GuillotineStrip {
  y: number;
  height: number;
  cursorX: number;
}

interface GuillotineSheet {
  strips: GuillotineStrip[];
  maxX: number;
  maxY: number;
}

function itemOrientations(item: Item): [number, number][] {
  if (!item.canRotate || item.w === item.h) return [[item.w, item.h]];
  return [
    [item.w, item.h],
    [item.h, item.w],
  ];
}

function sheetUsedHeight(sheet: GuillotineSheet): number {
  return sheet.strips.reduce((m, s) => Math.max(m, s.y + s.height), 0);
}

function pushOffcutFromRect(
  offcuts: LayoutOffcut[],
  sheetIndex: number,
  w: number,
  h: number,
  kerf: number,
): void {
  const uw = Math.floor(w - kerf);
  const uh = Math.floor(h - kerf);
  if (uw <= 0 || uh <= 0) return;
  if (uw < MIN_OFFCUT_MM || uh < MIN_OFFCUT_MM) return;
  const lengthMm = Math.max(uw, uh);
  const widthMm = Math.min(uw, uh);
  offcuts.push({
    sheetIndex,
    widthMm,
    lengthMm,
    areaMm2: widthMm * lengthMm,
  });
}

interface PlacementPlan {
  sheetIndex: number;
  x: number;
  y: number;
  iw: number;
  ih: number;
  /** Lower = better (existing strip before new strip before new sheet). */
  rank: number;
}

function planPlacement(
  sheets: GuillotineSheet[],
  iw: number,
  ih: number,
  binW: number,
  binH: number,
): PlacementPlan | null {
  let best: PlacementPlan | null = null;

  const consider = (plan: PlacementPlan) => {
    if (!best || plan.rank < best.rank) best = plan;
  };

  for (let si = 0; si < sheets.length; si++) {
    const sheet = sheets[si];
    for (let ti = 0; ti < sheet.strips.length; ti++) {
      const strip = sheet.strips[ti];
      if (ih > strip.height) continue;
      if (strip.cursorX + iw > binW) continue;
      consider({
        sheetIndex: si,
        x: strip.cursorX,
        y: strip.y,
        iw,
        ih,
        rank: si * 10 + ti,
      });
    }

    const newY = sheetUsedHeight(sheet);
    if (newY + ih <= binH && iw <= binW) {
      consider({
        sheetIndex: si,
        x: 0,
        y: newY,
        iw,
        ih,
        rank: 100 + si,
      });
    }
  }

  const newSheetRank = 1000 + sheets.length;
  if (ih <= binH && iw <= binW) {
    consider({
      sheetIndex: sheets.length,
      x: 0,
      y: 0,
      iw,
      ih,
      rank: newSheetRank,
    });
  }

  return best;
}

function applyPlan(
  sheets: GuillotineSheet[],
  plan: PlacementPlan,
  item: Item,
  kerf: number,
  placementsBySheet: LayoutPlacement[][],
): void {
  while (sheets.length <= plan.sheetIndex) {
    sheets.push({ strips: [], maxX: 0, maxY: 0 });
  }
  const sheet = sheets[plan.sheetIndex];

  let strip = sheet.strips.find((s) => s.y === plan.y);
  if (!strip) {
    strip = { y: plan.y, height: plan.ih, cursorX: 0 };
    sheet.strips.push(strip);
    sheet.strips.sort((a, b) => a.y - b.y);
  }

  if (!placementsBySheet[plan.sheetIndex]) placementsBySheet[plan.sheetIndex] = [];
  placementsBySheet[plan.sheetIndex].push({
    x: plan.x,
    y: plan.y,
    widthMm: Math.max(0, plan.iw - kerf),
    heightMm: Math.max(0, plan.ih - kerf),
    label: item.label,
    grainLocked: item.grainLocked,
  });

  strip.cursorX = Math.max(strip.cursorX, plan.x + plan.iw);
  strip.height = Math.max(strip.height, plan.ih);
  sheet.maxX = Math.max(sheet.maxX, plan.x + plan.iw);
  sheet.maxY = Math.max(sheet.maxY, plan.y + plan.ih);
}

function guillotineOffcutRects(
  sheet: GuillotineSheet,
  binW: number,
  binH: number,
  kerf: number,
): LayoutOffcutRect[] {
  const rects: LayoutOffcutRect[] = [];
  for (const strip of sheet.strips) {
    const rw = binW - strip.cursorX;
    if (rw >= MIN_OFFCUT_MM + kerf) {
      const uw = Math.floor(rw - kerf);
      const uh = Math.floor(strip.height - kerf);
      if (uw >= MIN_OFFCUT_MM && uh >= MIN_OFFCUT_MM) {
        rects.push({
          x: strip.cursorX,
          y: strip.y,
          widthMm: uw,
          heightMm: uh,
        });
      }
    }
  }
  const usedY = sheetUsedHeight(sheet);
  const bh = binH - usedY;
  if (bh >= MIN_OFFCUT_MM + kerf) {
    const uw = Math.floor(binW - kerf);
    const uh = Math.floor(bh - kerf);
    if (uw >= MIN_OFFCUT_MM && uh >= MIN_OFFCUT_MM) {
      rects.push({ x: 0, y: usedY, widthMm: uw, heightMm: uh });
    }
  }
  return rects;
}

/**
 * Lay parts onto full sheets using panel-saw style guillotine nesting:
 * rip strips across the cross-grain (full sheet length), then crosscut parts along the grain.
 * Sheet grain runs along the sheet's long side; grain-locked parts keep `length` on that axis.
 */
export function layoutSheets(
  pieces: LayoutPiece[],
  sheetWidth: number,
  sheetHeight: number,
  kerf = SAW_KERF_MM,
  purchaseFraction = 0.25,
): SheetLayoutResult {
  const grainLen = Math.max(sheetWidth, sheetHeight);
  const crossLen = Math.min(sheetWidth, sheetHeight);
  const binW = grainLen + kerf;
  const binH = crossLen + kerf;

  const items: Item[] = [];
  const unplaced: LayoutPiece[] = [];
  for (const p of pieces) {
    if (p.qty <= 0 || p.length <= 0 || p.width <= 0) continue;
    const w = p.length + kerf;
    const h = p.width + kerf;
    const fitsLocked = w <= binW && h <= binH;
    const fitsRotated = h <= binW && w <= binH;
    if (p.grainLocked ? !fitsLocked : !fitsLocked && !fitsRotated) {
      unplaced.push(p);
      continue;
    }
    const label = p.label.trim() || `${p.length}×${p.width}`;
    for (let i = 0; i < p.qty; i++) {
      items.push({ w, h, canRotate: !p.grainLocked, label, grainLocked: p.grainLocked });
    }
  }

  items.sort((a, b) => b.h - a.h || b.w - a.w || b.w * b.h - a.w * a.h);

  const sheets: GuillotineSheet[] = [];
  const placementsBySheet: LayoutPlacement[][] = [];

  for (const item of items) {
    let bestPlan: PlacementPlan | null = null;
    for (const [iw, ih] of itemOrientations(item)) {
      const plan = planPlacement(sheets, iw, ih, binW, binH);
      if (!plan) continue;
      if (!bestPlan || plan.rank < bestPlan.rank) {
        bestPlan = { ...plan, iw, ih };
      } else if (plan.rank === bestPlan.rank && iw * ih < bestPlan.iw * bestPlan.ih) {
        bestPlan = { ...plan, iw, ih };
      }
    }
    if (!bestPlan) {
      continue;
    }
    applyPlan(sheets, bestPlan, item, kerf, placementsBySheet);
  }

  if (sheets.length === 0) {
    return { sheetsUsed: 0, sheetsToOrder: 0, unplaced, offcuts: [], sheetDetails: [] };
  }

  const last = sheets[sheets.length - 1];
  const usedFraction =
    (Math.min(last.maxX, grainLen) * Math.min(last.maxY, crossLen)) / (grainLen * crossLen);
  const step = purchaseFraction > 0 ? purchaseFraction : 0.25;
  const lastSheet = Math.max(step, Math.ceil(usedFraction / step - 1e-9) * step);

  const offcuts: LayoutOffcut[] = [];
  sheets.forEach((sheet, idx) => {
    for (const strip of sheet.strips) {
      pushOffcutFromRect(offcuts, idx + 1, binW - strip.cursorX, strip.height, kerf);
    }
    const usedY = sheetUsedHeight(sheet);
    pushOffcutFromRect(offcuts, idx + 1, binW, binH - usedY, kerf);
  });
  offcuts.sort((a, b) => b.areaMm2 - a.areaMm2 || b.lengthMm - a.lengthMm);

  const sheetDetails: LayoutSheetDetail[] = sheets.map((sheet, idx) => ({
    sheetIndex: idx + 1,
    grainLengthMm: grainLen,
    crossLengthMm: crossLen,
    placements: placementsBySheet[idx] ?? [],
    offcutRects: guillotineOffcutRects(sheet, binW, binH, kerf),
  }));

  return {
    sheetsUsed: sheets.length,
    sheetsToOrder: sheets.length - 1 + Math.min(1, lastSheet),
    unplaced,
    offcuts,
    sheetDetails,
  };
}
