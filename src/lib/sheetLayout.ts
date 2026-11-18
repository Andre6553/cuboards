
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

/**
 * Prefer tucking a slightly shorter part into an existing rip-strip remnant
 * (e.g. 284 shelf into a 296 door strip) instead of opening a new strip.
 * Large mismatches (e.g. 100 filler into 300) still open their own strip.
 */
export const MAX_STRIP_HEIGHT_SLACK_MM = 25;

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
  /** Display label, e.g. "Offcut 1 · 450 × 1200". */
  label: string;
}

export interface LayoutPaidRegion {
  x: number;
  y: number;
  widthMm: number;
  heightMm: number;
  billedFraction: number;
  label: string;
}

export interface LayoutSheetDetail {
  sheetIndex: number;
  /** Grain runs along this axis (mm). */
  grainLengthMm: number;
  crossLengthMm: number;
  placements: LayoutPlacement[];
  /** Usable free rectangles (both sides ≥ MIN_OFFCUT_MM), for diagrams. */
  offcutRects: LayoutOffcutRect[];
  /** Buy-as billed area on this sheet (geometry for the map overlay). */
  paidRegion: LayoutPaidRegion;
}

export interface SheetLayoutResult {
  sheetsUsed: number;
  /** Full sheets + rounded-up fraction of the last sheet (purchase step: ⅓, ¼, ½, …). */
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

/** Buy-as steps needed for the nest bounding box after placing at x,y (1 = first ¼/⅓/½). */
function purchaseStepsAfter(
  sheet: GuillotineSheet | undefined,
  x: number,
  y: number,
  iw: number,
  ih: number,
  grainLen: number,
  crossLen: number,
  purchaseFraction: number,
): number {
  const step = purchaseFraction > 0 && purchaseFraction < 0.999 ? purchaseFraction : 1;
  if (step >= 0.999) return 1;
  const maxX = Math.min(grainLen, Math.max(sheet?.maxX ?? 0, x + iw));
  const maxY = Math.min(crossLen, Math.max(sheet?.maxY ?? 0, y + ih));
  const usedFrac = (maxX * maxY) / (grainLen * crossLen);
  return Math.max(1, Math.ceil(usedFrac / step - 1e-9));
}

function planPlacement(
  sheets: GuillotineSheet[],
  iw: number,
  ih: number,
  binW: number,
  binH: number,
  grainLen: number,
  crossLen: number,
  purchaseFraction: number,
): PlacementPlan | null {
  let best: PlacementPlan | null = null;

  const consider = (plan: PlacementPlan) => {
    if (!best || plan.rank < best.rank) best = plan;
  };

  // Rank = sheet*1000 + Buy-as step*80 + local strip preference.
  // Fill the first ¼ / ⅓ / ½ (board Buy as) before spilling into the next step.
  // Within a step: exact rip height → near-height remnant → new strip → large short-in-tall.
  for (let si = 0; si < sheets.length; si++) {
    const sheet = sheets[si];
    const sheetBase = si * 1000;
    for (let ti = 0; ti < sheet.strips.length; ti++) {
      const strip = sheet.strips[ti];
      if (ih > strip.height) continue;
      if (strip.cursorX + iw > binW) continue;
      const slack = strip.height - ih;
      let local: number;
      if (slack === 0) local = ti;
      else if (slack <= MAX_STRIP_HEIGHT_SLACK_MM) local = 100 + ti;
      else local = 700 + ti;
      const steps = purchaseStepsAfter(
        sheet,
        strip.cursorX,
        strip.y,
        iw,
        ih,
        grainLen,
        crossLen,
        purchaseFraction,
      );
      consider({
        sheetIndex: si,
        x: strip.cursorX,
        y: strip.y,
        iw,
        ih,
        rank: sheetBase + (steps - 1) * 80 + local,
      });
    }

    const newY = sheetUsedHeight(sheet);
    if (newY + ih <= binH && iw <= binW) {
      const steps = purchaseStepsAfter(sheet, 0, newY, iw, ih, grainLen, crossLen, purchaseFraction);
      consider({
        sheetIndex: si,
        x: 0,
        y: newY,
        iw,
        ih,
        rank: sheetBase + (steps - 1) * 80 + 500,
      });
    }
  }

  if (ih <= binH && iw <= binW) {
    const steps = purchaseStepsAfter(undefined, 0, 0, iw, ih, grainLen, crossLen, purchaseFraction);
    consider({
      sheetIndex: sheets.length,
      x: 0,
      y: 0,
      iw,
      ih,
      rank: sheets.length * 1000 + (steps - 1) * 80 + 500,
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

/** Rebuild guillotine strips from placements (sizes are finished mm; kerf sits between parts). */
function rebuildSheetFromPlacements(placements: LayoutPlacement[], kerf: number): GuillotineSheet {
  const byY = new Map<number, LayoutPlacement[]>();
  for (const p of placements) {
    const list = byY.get(p.y) ?? [];
    list.push(p);
    byY.set(p.y, list);
  }
  const strips: GuillotineStrip[] = [];
  let maxX = 0;
  let maxY = 0;
  for (const [y, parts] of [...byY.entries()].sort((a, b) => a[0] - b[0])) {
    const height = Math.max(...parts.map((p) => p.heightMm + kerf));
    const cursorX = Math.max(...parts.map((p) => p.x + p.widthMm + kerf), 0);
    strips.push({ y, height, cursorX });
    maxX = Math.max(maxX, cursorX);
    maxY = Math.max(maxY, y + height);
  }
  return { strips, maxX, maxY };
}

/**
 * Move parts from later sheets into free space on earlier sheets when grain + kerf allow.
 * Board wastage % is not used here (quote sheet-count only).
 */
function compactIntoEarlierSheets(
  sheets: GuillotineSheet[],
  placementsBySheet: LayoutPlacement[][],
  binW: number,
  binH: number,
  kerf: number,
  grainLen: number,
  crossLen: number,
  purchaseFraction: number,
): void {
  let moved = true;
  let guard = 0;
  while (moved && guard++ < 500) {
    moved = false;
    for (let si = sheets.length - 1; si >= 1; si--) {
      const placements = placementsBySheet[si] ?? [];
      if (placements.length === 0) continue;
      // Smallest first — tuck leftovers into earlier remnants.
      const order = [...placements.keys()].sort(
        (a, b) => placements[a].widthMm * placements[a].heightMm - placements[b].widthMm * placements[b].heightMm,
      );
      for (const pi of order) {
        const p = placementsBySheet[si][pi];
        if (!p) continue;
        const item: Item = {
          w: p.widthMm + kerf,
          h: p.heightMm + kerf,
          canRotate: !p.grainLocked,
          label: p.label,
          grainLocked: p.grainLocked,
        };

        const remaining = placementsBySheet[si].filter((_, idx) => idx !== pi);
        const savedSheet = sheets[si];
        sheets[si] = rebuildSheetFromPlacements(remaining, kerf);

        let bestPlan: PlacementPlan | null = null;
        for (const [iw, ih] of itemOrientations(item)) {
          const plan = planPlacement(sheets, iw, ih, binW, binH, grainLen, crossLen, purchaseFraction);
          if (!plan || plan.sheetIndex >= si) continue;
          if (!bestPlan || plan.rank < bestPlan.rank) bestPlan = { ...plan, iw, ih };
        }

        if (!bestPlan) {
          sheets[si] = savedSheet;
          continue;
        }

        placementsBySheet[si] = remaining;
        applyPlan(sheets, bestPlan, item, kerf, placementsBySheet);
        // Refresh source sheet strips after removal.
        sheets[si] = rebuildSheetFromPlacements(placementsBySheet[si], kerf);
        moved = true;
        break;
      }
      if (moved) break;
    }
  }

  // Drop trailing empty sheets.
  while (sheets.length > 0) {
    const last = sheets.length - 1;
    if ((placementsBySheet[last] ?? []).length > 0) break;
    sheets.pop();
    placementsBySheet.pop();
  }
}

function offcutLabel(index: number, widthMm: number, heightMm: number): string {
  const a = Math.round(Math.max(widthMm, heightMm));
  const b = Math.round(Math.min(widthMm, heightMm));
  return `Offcut ${index} · ${a} × ${b}`;
}

/** Human label for a billed sheet fraction (Buy as step). */
export function billedFractionLabel(fraction: number): string {
  const f = Math.min(1, Math.max(0, fraction));
  if (f >= 0.999) return 'Paying · full sheet';
  if (Math.abs(f - 0.5) < 0.02) return 'Paying · ½ sheet';
  if (Math.abs(f - 1 / 3) < 0.02) return 'Paying · ⅓ sheet';
  if (Math.abs(f - 0.25) < 0.02) return 'Paying · ¼ sheet';
  if (Math.abs(f - 0.75) < 0.02) return 'Paying · ¾ sheet';
  if (Math.abs(f - 2 / 3) < 0.02) return 'Paying · ⅔ sheet';
  const pct = Math.round(f * 100);
  return `Paying · ${pct}% sheet`;
}

/**
 * Rectangle from the origin covering the billed Buy-as area, grown from the used nest box
 * so parts stay inside the paid overlay.
 */
export function paidRegionForSheet(
  grainLen: number,
  crossLen: number,
  usedMaxX: number,
  usedMaxY: number,
  billedFraction: number,
): LayoutPaidRegion {
  const frac = Math.min(1, Math.max(0, billedFraction));
  const target = frac * grainLen * crossLen;
  let w = Math.min(grainLen, Math.max(1, usedMaxX));
  let h = Math.min(crossLen, Math.max(1, usedMaxY));
  if (w * h < target) {
    // Grow along grain first (typical rip), then across.
    w = Math.min(grainLen, Math.max(w, target / h));
    if (w * h < target) {
      h = Math.min(crossLen, Math.max(h, target / w));
    }
  }
  if (frac >= 0.999) {
    w = grainLen;
    h = crossLen;
  }
  return {
    x: 0,
    y: 0,
    widthMm: Math.round(w * 10) / 10,
    heightMm: Math.round(h * 10) / 10,
    billedFraction: frac,
    label: billedFractionLabel(frac),
  };
}

function guillotineOffcutRects(
  sheet: GuillotineSheet,
  binW: number,
  binH: number,
  kerf: number,
): LayoutOffcutRect[] {
  const raw: Omit<LayoutOffcutRect, 'label'>[] = [];
  for (const strip of sheet.strips) {
    const rw = binW - strip.cursorX;
    if (rw >= MIN_OFFCUT_MM + kerf) {
      const uw = Math.floor(rw - kerf);
      const uh = Math.floor(strip.height - kerf);
      if (uw >= MIN_OFFCUT_MM && uh >= MIN_OFFCUT_MM) {
        raw.push({
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
      raw.push({ x: 0, y: usedY, widthMm: uw, heightMm: uh });
    }
  }
  // Largest first so Offcut 1 is the best keeper.
  raw.sort((a, b) => b.widthMm * b.heightMm - a.widthMm * a.heightMm);
  return raw.map((r, i) => ({
    ...r,
    label: offcutLabel(i + 1, r.widthMm, r.heightMm),
  }));
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

  // Grain-locked first (doors/sides), then rotatable — so free ends of locked
  // strips can take shelves/fillers before a new sheet is opened. Still height-major.
  items.sort(
    (a, b) =>
      Number(b.grainLocked) - Number(a.grainLocked) ||
      b.h - a.h ||
      b.w - a.w ||
      b.w * b.h - a.w * a.h,
  );

  const sheets: GuillotineSheet[] = [];
  const placementsBySheet: LayoutPlacement[][] = [];

  for (const item of items) {
    let bestPlan: PlacementPlan | null = null;
    for (const [iw, ih] of itemOrientations(item)) {
      const plan = planPlacement(sheets, iw, ih, binW, binH, grainLen, crossLen, purchaseFraction);
      if (!plan) continue;
      if (!bestPlan || plan.rank < bestPlan.rank) {
        bestPlan = { ...plan, iw, ih };
      } else if (plan.rank === bestPlan.rank) {
        // Same shelf/sheet choice: prefer lower cross-grain height so a rotatable
        // panel (e.g. 780×1810) does not lock a full-height rip strip and force
        // an extra sheet for a leftover filler. Then prefer smaller footprint.
        if (ih < bestPlan.ih || (ih === bestPlan.ih && iw * ih < bestPlan.iw * bestPlan.ih)) {
          bestPlan = { ...plan, iw, ih };
        }
      }
    }
    if (!bestPlan) {
      continue;
    }
    applyPlan(sheets, bestPlan, item, kerf, placementsBySheet);
  }

  compactIntoEarlierSheets(
    sheets,
    placementsBySheet,
    binW,
    binH,
    kerf,
    grainLen,
    crossLen,
    purchaseFraction,
  );

  if (sheets.length === 0) {
    return { sheetsUsed: 0, sheetsToOrder: 0, unplaced, offcuts: [], sheetDetails: [] };
  }

  const last = sheets[sheets.length - 1];
  const usedFraction =
    (Math.min(last.maxX, grainLen) * Math.min(last.maxY, crossLen)) / (grainLen * crossLen);
  const step = purchaseFraction > 0 ? purchaseFraction : 0.25;
  const lastSheetFrac = Math.max(step, Math.ceil(usedFraction / step - 1e-9) * step);

  const offcuts: LayoutOffcut[] = [];
  sheets.forEach((sheet, idx) => {
    for (const strip of sheet.strips) {
      pushOffcutFromRect(offcuts, idx + 1, binW - strip.cursorX, strip.height, kerf);
    }
    const usedY = sheetUsedHeight(sheet);
    pushOffcutFromRect(offcuts, idx + 1, binW, binH - usedY, kerf);
  });
  offcuts.sort((a, b) => b.areaMm2 - a.areaMm2 || b.lengthMm - a.lengthMm);

  const sheetDetails: LayoutSheetDetail[] = sheets.map((sheet, idx) => {
    const isLast = idx === sheets.length - 1;
    const billedFraction = isLast ? Math.min(1, lastSheetFrac) : 1;
    const usedX = Math.min(sheet.maxX, grainLen);
    const usedY = Math.min(sheet.maxY, crossLen);
    return {
      sheetIndex: idx + 1,
      grainLengthMm: grainLen,
      crossLengthMm: crossLen,
      placements: placementsBySheet[idx] ?? [],
      offcutRects: guillotineOffcutRects(sheet, binW, binH, kerf),
      paidRegion: paidRegionForSheet(grainLen, crossLen, usedX, usedY, billedFraction),
    };
  });

  return {
    sheetsUsed: sheets.length,
    sheetsToOrder: sheets.length - 1 + Math.min(1, lastSheetFrac),
    unplaced,
    offcuts,
    sheetDetails,
  };
}
