
import type { CutPiece } from '../types';

/** Grain always runs along the first size shown on the cut list (Length). */
export function grainLabel(grain: CutPiece['grain']): string {
  if (grain === 'vertical') return 'Top to bottom';
  if (grain === 'horizontal') return 'Along length';
  return '—';
}

/** Saw blade width allowed between parts on the sheet. */
export const SAW_KERF_MM = 4;

export interface LayoutPiece {
  /** Along the part's grain when `grainLocked` (e.g. door height). */
  length: number;
  width: number;
  qty: number;
  /** Part must sit with `length` along the sheet grain (sheet's long side) — no rotation. */
  grainLocked: boolean;
  label: string;
}

export interface SheetLayoutResult {
  sheetsUsed: number;
  /** Full sheets + rounded-up fraction of the last sheet (¼ steps). */
  sheetsToOrder: number;
  /** Parts that cannot fit on a sheet in the required grain direction. */
  unplaced: LayoutPiece[];
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
    for (let i = 0; i < p.qty; i++) items.push({ w, h, canRotate: !p.grainLocked });
  }

  items.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h);

  const sheets: Sheet[] = [];
  for (const item of items) {
    let placed = false;
    for (const sheet of sheets) {
      const spot = bestFit(sheet, item);
      if (spot) {
        placeRect(sheet, spot);
        placed = true;
        break;
      }
    }
    if (!placed) {
      const sheet: Sheet = { free: [{ x: 0, y: 0, w: binW, h: binH }], maxX: 0, maxY: 0 };
      const spot = bestFit(sheet, item);
      if (spot) placeRect(sheet, spot);
      sheets.push(sheet);
    }
  }

  if (sheets.length === 0) return { sheetsUsed: 0, sheetsToOrder: 0, unplaced };

  const last = sheets[sheets.length - 1];
  const usedFraction = (Math.min(last.maxX, grainLen) * Math.min(last.maxY, crossLen)) / (grainLen * crossLen);
  const step = purchaseFraction > 0 ? purchaseFraction : 0.25;
  const lastSheet = Math.max(step, Math.ceil(usedFraction / step - 1e-9) * step);

  return {
    sheetsUsed: sheets.length,
    sheetsToOrder: sheets.length - 1 + Math.min(1, lastSheet),
    unplaced,
  };
}
