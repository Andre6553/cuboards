import type { JobSettings, KickplateCoverage, KitchenPlinthConfig } from '../types';

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
