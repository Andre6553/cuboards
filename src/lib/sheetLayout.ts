
import type { CutPiece } from '../types';

/** Grain always runs along the first size shown on the cut list (Length). */
export function grainLabel(grain: CutPiece['grain']): string {
  if (grain === 'vertical') return 'Top to bottom';
  if (grain === 'horizontal') return 'Along length';
  return '—';
}

/** Saw blade width allowed between parts on the sheet. */
export const SAW_KERF_MM = 4;

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

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Sheet {
  free: Rect[];
  maxX: number;
  maxY: number;
}

interface Item {
  w: number;
  h: number;
  canRotate: boolean;
  label: string;
  grainLocked: boolean;
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

function placeRect(sheet: Sheet, placed: Rect): void {
  const next: Rect[] = [];
  for (const f of sheet.free) {
    if (!intersects(f, placed)) {
      next.push(f);
      continue;
    }
    if (placed.x > f.x) next.push({ x: f.x, y: f.y, w: placed.x - f.x, h: f.h });
    if (placed.x + placed.w < f.x + f.w) {
      next.push({ x: placed.x + placed.w, y: f.y, w: f.x + f.w - (placed.x + placed.w), h: f.h });
    }
    if (placed.y > f.y) next.push({ x: f.x, y: f.y, w: f.w, h: placed.y - f.y });
    if (placed.y + placed.h < f.y + f.h) {
      next.push({ x: f.x, y: placed.y + placed.h, w: f.w, h: f.y + f.h - (placed.y + placed.h) });
    }
  }
  sheet.free = next.filter((r, i) => !next.some((o, j) => j !== i && contains(o, r) && (j < i || !contains(r, o))));
  sheet.maxX = Math.max(sheet.maxX, placed.x + placed.w);
  sheet.maxY = Math.max(sheet.maxY, placed.y + placed.h);
}

function bestFit(sheet: Sheet, item: Item): Rect | null {
  let best: Rect | null = null;
  let bestShort = Infinity;
  let bestLong = Infinity;
  const orientations: [number, number][] = item.canRotate && item.w !== item.h
    ? [[item.w, item.h], [item.h, item.w]]
    : [[item.w, item.h]];
  for (const f of sheet.free) {
    for (const [w, h] of orientations) {
      if (w > f.w || h > f.h) continue;
      const short = Math.min(f.w - w, f.h - h);
      const long = Math.max(f.w - w, f.h - h);
      if (short < bestShort || (short === bestShort && long < bestLong)) {
        best = { x: f.x, y: f.y, w, h };
        bestShort = short;
        bestLong = long;
      }
    }
  }
  return best;
}

/**
 * Lay parts onto full sheets. Sheet grain runs along the sheet's long side;
 * grain-locked parts keep their `length` on that axis, other parts may rotate.
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
  // Each part carries one kerf; the bin gets one extra so edge parts don't lose a blade width.
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

  items.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h);

  const sheets: Sheet[] = [];
  const placementsBySheet: LayoutPlacement[][] = [];

  const recordPlacement = (sheetIndex: number, spot: Rect, item: Item) => {
    if (!placementsBySheet[sheetIndex]) placementsBySheet[sheetIndex] = [];
    placementsBySheet[sheetIndex].push({
      x: spot.x,
      y: spot.y,
      widthMm: Math.max(0, spot.w - kerf),
      heightMm: Math.max(0, spot.h - kerf),
      label: item.label,
      grainLocked: item.grainLocked,
    });
  };

  for (const item of items) {
    let placed = false;
    for (let si = 0; si < sheets.length; si++) {
      const sheet = sheets[si];
      const spot = bestFit(sheet, item);
      if (spot) {
        placeRect(sheet, spot);
        recordPlacement(si, spot, item);
        placed = true;
        break;
      }
    }
    if (!placed) {
      const sheet: Sheet = { free: [{ x: 0, y: 0, w: binW, h: binH }], maxX: 0, maxY: 0 };
      const spot = bestFit(sheet, item);
      if (spot) {
        placeRect(sheet, spot);
        sheets.push(sheet);
        recordPlacement(sheets.length - 1, spot, item);
      } else {
        sheets.push(sheet);
      }
    }
  }

  if (sheets.length === 0) {
    return { sheetsUsed: 0, sheetsToOrder: 0, unplaced, offcuts: [], sheetDetails: [] };
  }

  const last = sheets[sheets.length - 1];
  const usedFraction = (Math.min(last.maxX, grainLen) * Math.min(last.maxY, crossLen)) / (grainLen * crossLen);
  const step = purchaseFraction > 0 ? purchaseFraction : 0.25;
  const lastSheet = Math.max(step, Math.ceil(usedFraction / step - 1e-9) * step);

  const offcuts: LayoutOffcut[] = [];
  sheets.forEach((sheet, idx) => {
    for (const r of sheet.free) {
      let w = Math.floor(r.w - kerf);
      let h = Math.floor(r.h - kerf);
      if (w <= 0 || h <= 0) continue;
      if (w < MIN_OFFCUT_MM || h < MIN_OFFCUT_MM) continue;
      const lengthMm = Math.max(w, h);
      const widthMm = Math.min(w, h);
      offcuts.push({
        sheetIndex: idx + 1,
        widthMm,
        lengthMm,
        areaMm2: widthMm * lengthMm,
      });
    }
  });
  offcuts.sort((a, b) => b.areaMm2 - a.areaMm2 || b.lengthMm - a.lengthMm);

  const sheetDetails: LayoutSheetDetail[] = sheets.map((sheet, idx) => {
    const offcutRects: LayoutOffcutRect[] = [];
    for (const r of sheet.free) {
      const w = Math.floor(r.w - kerf);
      const h = Math.floor(r.h - kerf);
      if (w < MIN_OFFCUT_MM || h < MIN_OFFCUT_MM) continue;
      offcutRects.push({
        x: r.x,
        y: r.y,
        widthMm: w,
        heightMm: h,
      });
    }
    return {
      sheetIndex: idx + 1,
      grainLengthMm: grainLen,
      crossLengthMm: crossLen,
      placements: placementsBySheet[idx] ?? [],
      offcutRects,
    };
  });

  return {
    sheetsUsed: sheets.length,
    sheetsToOrder: sheets.length - 1 + Math.min(1, lastSheet),
    unplaced,
    offcuts,
    sheetDetails,
  };
}
