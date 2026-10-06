import type { KickplateCoverage, KitchenPlinthConfig } from '../types';

export function kickplateRunLengthMm(
  width: number,
  depth: number,
  coverage: KickplateCoverage,
): number {
  switch (coverage) {
    case 'front':
      return width;
    case 'front-one-side':
      return width + depth;
    case 'front-both-sides':
      return width + 2 * depth;
    default:
      return width;
  }
}

export interface WoodKickplatePiece {
  partName: string;
  width: number;
  length: number;
  notes: string;
}

/** Wood kickplate board cuts (height × run length per piece). */
export function woodKickplatePieces(
  width: number,
  depth: number,
  height: number,
  plinth: KitchenPlinthConfig,
): WoodKickplatePiece[] {
  const pieces: WoodKickplatePiece[] = [
    { partName: 'Kickplate (front)', width: height, length: width, notes: 'Front face' },
  ];

  if (plinth.kickplateCoverage === 'front-one-side') {
    const side = plinth.kickplateSide === 'right' ? 'right' : 'left';
    pieces.push({
      partName: `Kickplate (${side} side)`,
      width: height,
      length: depth,
      notes: `${side} return`,
    });
  } else if (plinth.kickplateCoverage === 'front-both-sides') {
    pieces.push(
      { partName: 'Kickplate (left side)', width: height, length: depth, notes: 'Left return' },
      { partName: 'Kickplate (right side)', width: height, length: depth, notes: 'Right return' },
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
