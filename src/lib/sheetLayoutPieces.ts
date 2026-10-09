import type { CutPiece } from '../types';
import type { LayoutPiece } from './sheetLayout';

function mapLabel(partName: string, unitName: string): string {
  const raw = unitName ? `${partName} · ${unitName}` : partName;
  const max = 32;
  return raw.length <= max ? raw : `${raw.slice(0, max - 1)}…`;
}

export function cutPiecesToLayout(pieces: CutPiece[]): LayoutPiece[] {
  return pieces.map((p) => ({
    length: p.length,
    width: p.width,
    qty: p.qty,
    grainLocked: p.grain !== 'none',
    label: mapLabel(p.partName, p.unitName),
  }));
}
