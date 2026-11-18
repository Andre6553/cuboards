import type {
  JobSettings,
  KickplateCoverage,
  KitchenPlinthConfig,
  PlasticKickplateConfig,
  PlasticKickplateLine,
  PlasticKickplatePurchase,
} from '../types';

/** Gelmar / plastic strip heights offered on the unit plinth dropdown. */
export const PLASTIC_KICKPLATE_HEIGHTS = [100, 150] as const;
export type PlasticKickplateHeight = (typeof PLASTIC_KICKPLATE_HEIGHTS)[number];

/** Sold length of one PVC/Gelmar plinth strip (users buy whole strips only). */
export const PLASTIC_KICKPLATE_STRIP_LENGTH_M = 3;

/** Whole 3 m strips to buy for a needed run (e.g. 3.5 m → 2 strips → 6.00 m billed). */
export function plasticKickplateStripsToBuy(neededMetres: number): {
  neededMetres: number;
  stripsToBuy: number;
  billableMetres: number;
} {
  const needed = Math.max(0, neededMetres);
  if (needed <= 0) return { neededMetres: 0, stripsToBuy: 0, billableMetres: 0 };
  const stripsToBuy = Math.ceil(needed / PLASTIC_KICKPLATE_STRIP_LENGTH_M);
  return {
    neededMetres: needed,
    stripsToBuy,
    billableMetres: stripsToBuy * PLASTIC_KICKPLATE_STRIP_LENGTH_M,
  };
}

/**
 * Sum same product/height/price runs, then buy whole 3 m strips
 * (e.g. 17.89 m → 6 × 3 m = 18.00 m billed).
 */
export function summarizePlasticKickplatePurchases(
  lines: PlasticKickplateLine[],
): PlasticKickplatePurchase[] {
  const groups = new Map<string, PlasticKickplatePurchase>();
  for (const line of lines) {
    if (line.totalMetres <= 0) continue;
    const key = JSON.stringify([
      line.productName,
      line.stripHeight,
      line.stripWidth,
      line.pricePerMetre,
    ]);
    const existing = groups.get(key);
    if (existing) {
      existing.neededMetres += line.totalMetres;
    } else {
      groups.set(key, {
        productName: line.productName,
        stripHeight: line.stripHeight,
        stripWidth: line.stripWidth,
        pricePerMetre: line.pricePerMetre,
        neededMetres: line.totalMetres,
        stripsToBuy: 0,
        billableMetres: 0,
        subtotal: 0,
      });
    }
  }
  return Array.from(groups.values()).map((g) => {
    const buy = plasticKickplateStripsToBuy(g.neededMetres);
    return {
      ...g,
      neededMetres: Math.round(buy.neededMetres * 1000) / 1000,
      stripsToBuy: buy.stripsToBuy,
      billableMetres: buy.billableMetres,
      subtotal: buy.billableMetres * g.pricePerMetre,
    };
  });
}

export function plasticKickplatePurchaseDetail(p: PlasticKickplatePurchase): string {
  return (
    `${p.neededMetres.toFixed(2)} m needed · buy ${p.stripsToBuy} × ${PLASTIC_KICKPLATE_STRIP_LENGTH_M} m strip` +
    `${p.stripsToBuy === 1 ? '' : 's'} (${p.billableMetres.toFixed(2)} m) · ${p.stripHeight}×${p.stripWidth} mm`
  );
}

export function isPlasticKickplateHeight(n: number): n is PlasticKickplateHeight {
  return n === 100 || n === 150;
}

/** Snap any mm value to the nearer of 100 / 150 (ties → 100). */
export function snapPlasticKickplateHeight(heightMm: number): PlasticKickplateHeight {
  if (!Number.isFinite(heightMm)) return 100;
  return Math.abs(heightMm - 150) < Math.abs(heightMm - 100) ? 150 : 100;
}

/**
 * Keep job default `pricePerMetre` mirrored into the Gelmar height cache for the
 * active strip height so unit 100/150 pricing has a real per-height rate.
 */
export function normalizePlasticKickplate(config: PlasticKickplateConfig): PlasticKickplateConfig {
  const stripHeight = isPlasticKickplateHeight(config.stripHeight)
    ? config.stripHeight
    : snapPlasticKickplateHeight(config.stripHeight);
  const map = { ...config.gelmarPricePerMetreByHeight };
  if (
    (map[stripHeight] == null || !Number.isFinite(map[stripHeight])) &&
    Number.isFinite(config.pricePerMetre)
  ) {
    map[stripHeight] = config.pricePerMetre;
  }
  const pricePerMetre =
    typeof map[stripHeight] === 'number' && Number.isFinite(map[stripHeight])
      ? map[stripHeight]!
      : config.pricePerMetre;
  return {
    ...config,
    stripHeight,
    pricePerMetre,
    gelmarPricePerMetreByHeight: map,
  };
}

/**
 * R/m for a unit’s plastic kickplate height when Gelmar catalog is on.
 * Uses only that height’s cached rate (seeded from job default when needed).
 */
export function resolveGelmarPlasticKickplatePricePerMetre(
  config: PlasticKickplateConfig,
  heightMm: number,
): { stripHeight: PlasticKickplateHeight; pricePerMetre: number } {
  const normalized = normalizePlasticKickplate(config);
  const stripHeight = snapPlasticKickplateHeight(heightMm);
  const cached = normalized.gelmarPricePerMetreByHeight?.[stripHeight];
  if (typeof cached === 'number' && Number.isFinite(cached) && cached >= 0) {
    return { stripHeight, pricePerMetre: cached };
  }
  // Height not in cache yet — only reuse job default when it is that same height.
  if (normalized.stripHeight === stripHeight) {
    return { stripHeight, pricePerMetre: normalized.pricePerMetre };
  }
  // Other height missing its own rate: do not silently reuse the wrong size’s R/m.
  return { stripHeight, pricePerMetre: 0 };
}

export function withGelmarKickplatePrice(
  config: PlasticKickplateConfig,
  height: PlasticKickplateHeight,
  pricePerMetre: number,
): PlasticKickplateConfig {
  const next: PlasticKickplateConfig = {
    ...config,
    gelmarPricePerMetreByHeight: {
      ...config.gelmarPricePerMetreByHeight,
      [height]: pricePerMetre,
    },
  };
  if (config.stripHeight === height || !isPlasticKickplateHeight(config.stripHeight)) {
    next.stripHeight = height;
    next.pricePerMetre = pricePerMetre;
  }
  return next;
}

/** Gelmar-off: custom product for this unit, else match by height, else job default. */
export function resolvePlasticKickplateProductForUnit(
  config: PlasticKickplateConfig,
  plinth: Pick<KitchenPlinthConfig, 'plasticKickplateProductId' | 'kickplateHeight'>,
): {
  productName: string;
  stripHeight: number;
  stripWidth: number;
  pricePerMetre: number;
} {
  const byId = config.customProducts?.find((p) => p.id === plinth.plasticKickplateProductId);
  if (byId) {
    return {
      productName: byId.name || config.name || 'Plastic kickplate strip',
      stripHeight: byId.stripHeight,
      stripWidth: byId.stripWidth,
      pricePerMetre: byId.pricePerMetre,
    };
  }
  const want = snapPlasticKickplateHeight(plinth.kickplateHeight);
  const byHeight = config.customProducts?.find(
    (p) => snapPlasticKickplateHeight(p.stripHeight) === want,
  );
  if (byHeight) {
    return {
      productName: byHeight.name || config.name || 'Plastic kickplate strip',
      stripHeight: byHeight.stripHeight,
      stripWidth: byHeight.stripWidth,
      pricePerMetre: byHeight.pricePerMetre,
    };
  }
  return {
    productName: config.name || 'Plastic kickplate strip',
    stripHeight: want,
    stripWidth: config.stripWidth,
    pricePerMetre: config.pricePerMetre,
  };
}

/** Long side of the job sheet size (e.g. 2750 on a 2750 × 1830 board). */
export function boardSheetLengthMm(settings: Pick<JobSettings, 'sheetWidth' | 'sheetHeight'>): number {
  return Math.max(settings.sheetWidth, settings.sheetHeight);
}

/** Short side of the sheet (cross-grain). One kickplate strip’s run cannot exceed this. */
export function boardSheetCrossMm(settings: Pick<JobSettings, 'sheetWidth' | 'sheetHeight'>): number {
  return Math.min(settings.sheetWidth, settings.sheetHeight);
}

/** Max run on a single board piece (grain vertical along kick height). */
export function maxKickplatePieceRunMm(settings: Pick<JobSettings, 'sheetWidth' | 'sheetHeight'>): number {
  return boardSheetCrossMm(settings);
}

/** Upper bound for the front long-edge input (total run; may split into multiple pieces). */
export function maxKickplateFrontRunMm(
  cupboardWidth: number,
  settings: Pick<JobSettings, 'sheetWidth' | 'sheetHeight'>,
): number {
  return Math.max(Math.round(cupboardWidth), boardSheetLengthMm(settings) * 4);
}

export function maxKickplateSideRunMm(
  cupboardDepth: number,
  settings: Pick<JobSettings, 'sheetWidth' | 'sheetHeight'>,
): number {
  return Math.max(Math.round(cupboardDepth), boardSheetLengthMm(settings) * 4);
}

function clampRun(value: number, max: number): number {
  return Math.min(Math.max(1, Math.round(value)), max);
}

export function resolveKickplateFrontRunMm(
  cupboardWidth: number,
  plinth: KitchenPlinthConfig,
  settings?: Pick<JobSettings, 'sheetWidth' | 'sheetHeight'>,
): number {
  const max = settings ? maxKickplateFrontRunMm(cupboardWidth, settings) : Math.round(cupboardWidth);
  const v = plinth.kickplateFrontRunMm;
  if (v != null && Number.isFinite(v) && v > 0) return clampRun(v, max);
  return Math.round(cupboardWidth);
}

export function resolveKickplateSideRunMm(
  cupboardDepth: number,
  plinth: KitchenPlinthConfig,
  settings?: Pick<JobSettings, 'sheetWidth' | 'sheetHeight'>,
): number {
  const max = settings ? maxKickplateSideRunMm(cupboardDepth, settings) : Math.round(cupboardDepth);
  const v = plinth.kickplateSideRunMm;
  if (v != null && Number.isFinite(v) && v > 0) return clampRun(v, max);
  return Math.round(cupboardDepth);
}

export function kickplateRunLengthMm(
  width: number,
  depth: number,
  coverage: KickplateCoverage,
  plinth?: KitchenPlinthConfig,
  settings?: Pick<JobSettings, 'sheetWidth' | 'sheetHeight'>,
): number {
  const front = plinth ? resolveKickplateFrontRunMm(width, plinth, settings) : Math.round(width);
  const side = plinth ? resolveKickplateSideRunMm(depth, plinth, settings) : Math.round(depth);
  switch (coverage) {
    case 'front':
      return front;
    case 'front-one-side':
      return front + side;
    case 'front-both-sides':
      return front + 2 * side;
    default:
      return front;
  }
}

export interface WoodKickplatePiece {
  partName: string;
  width: number;
  length: number;
  notes: string;
}

/**
 * Wood kickplate board cuts.
 * Cut list length = kick height (grain top to bottom on the visible face); width = run along front/side.
 */
function splitKickplateRun(
  totalRun: number,
  kickHeight: number,
  maxPieceRun: number,
  partName: string,
  baseNotes: string,
): WoodKickplatePiece[] {
  if (totalRun <= 0 || kickHeight <= 0) return [];
  const maxRun = Math.max(1, Math.round(maxPieceRun));
  const run = Math.round(totalRun);
  if (run <= maxRun) {
    return [
      {
        partName,
        width: run,
        length: kickHeight,
        notes: baseNotes,
      },
    ];
  }
  const pieceCount = Math.ceil(run / maxRun);
  const out: WoodKickplatePiece[] = [];
  let remaining = run;
  for (let i = 0; i < pieceCount && remaining > 0; i++) {
    const w = i === pieceCount - 1 ? remaining : Math.min(remaining, maxRun);
    remaining -= w;
    const label = pieceCount > 1 ? `${partName} ${i + 1}/${pieceCount}` : partName;
    const joinNote =
      pieceCount > 1
        ? `Join on site · ${w} mm of ${run} mm total`
        : undefined;
    out.push({
      partName: label,
      width: w,
      length: kickHeight,
      notes: [baseNotes, joinNote].filter(Boolean).join(' · '),
    });
  }
  return out;
}

export function woodKickplatePieces(
  width: number,
  depth: number,
  height: number,
  plinth: KitchenPlinthConfig,
  settings?: Pick<JobSettings, 'sheetWidth' | 'sheetHeight'>,
): WoodKickplatePiece[] {
  const frontRun = resolveKickplateFrontRunMm(width, plinth, settings);
  const sideRun = resolveKickplateSideRunMm(depth, plinth, settings);
  const maxPiece = settings ? maxKickplatePieceRunMm(settings) : Math.max(frontRun, sideRun);
  const sizeNote = (run: number, auto: number) =>
    run !== Math.round(auto) ? `Long edge ${run} mm (user)` : undefined;

  const pieces: WoodKickplatePiece[] = splitKickplateRun(
    frontRun,
    height,
    maxPiece,
    'Kickplate (front)',
    ['Front face', sizeNote(frontRun, width)].filter(Boolean).join(' · '),
  );

  if (plinth.kickplateCoverage === 'front-one-side') {
    const side = plinth.kickplateSide === 'right' ? 'right' : 'left';
    pieces.push(
      ...splitKickplateRun(
        sideRun,
        height,
        maxPiece,
        `Kickplate (${side} side)`,
        [`${side} return`, sizeNote(sideRun, depth)].filter(Boolean).join(' · '),
      ),
    );
  } else if (plinth.kickplateCoverage === 'front-both-sides') {
    pieces.push(
      ...splitKickplateRun(
        sideRun,
        height,
        maxPiece,
        'Kickplate (left side)',
        ['Left return', sizeNote(sideRun, depth)].filter(Boolean).join(' · '),
      ),
      ...splitKickplateRun(
        sideRun,
        height,
        maxPiece,
        'Kickplate (right side)',
        ['Right return', sizeNote(sideRun, depth)].filter(Boolean).join(' · '),
      ),
    );
  }

  return pieces;
}

export function coverageLabel(coverage: KickplateCoverage): string {
  switch (coverage) {
    case 'front':
      return 'Front only';
    case 'front-one-side':
      return 'Front + one side';
    case 'front-both-sides':
      return 'Front + both sides';
    default:
      return coverage;
  }
}
