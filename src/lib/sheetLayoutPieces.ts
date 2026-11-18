import type { CutPiece } from '../types';
import type { LayoutPiece } from './sheetLayout';

function mapLabel(partName: string, unitName: string): string {
  const raw = unitName ? `${partName} · ${unitName}` : partName;
  const max = 32;
  return raw.length <= max ? raw : `${raw.slice(0, max - 1)}…`;
}

/**
 * Map cut-list pieces into nest inputs.
 * Grain boards: every part keeps cut-list Length along the sheet grain (no rotate).
 * Non-grain boards: only pieces marked with a grain direction are locked; others may rotate.
 */
export function cutPiecesToLayout(
  pieces: CutPiece[],
  options?: { materialHasGrain?: boolean },
): LayoutPiece[] {
  const lockAllToLength = options?.materialHasGrain === true;
  return pieces.map((p) => ({
    length: p.length,
    width: p.width,
    qty: p.qty,
    grainLocked: lockAllToLength || p.grain !== 'none',
    label: mapLabel(p.partName, p.unitName),
  }));
}
