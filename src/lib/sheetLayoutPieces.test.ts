import { describe, expect, it } from 'vitest';
import type { CutPiece } from '../types';
import { cutPiecesToLayout } from './sheetLayoutPieces';
import { layoutSheets } from './sheetLayout';

function piece(partial: Partial<CutPiece> & Pick<CutPiece, 'partName' | 'length' | 'width' | 'grain'>): CutPiece {
  return {
    category: 'carcass',
    materialId: 'board-1',
    materialName: 'Board',
    unitId: 'u1',
    unitName: 'Unit',
    qty: 1,
    notes: '',
    edgingPattern: 'none',
    ...partial,
  };
}

describe('cutPiecesToLayout grain boards', () => {
  it('locks every part to cut-list Length when the material has grain', () => {
    const pieces = [
      piece({ partName: 'Side', length: 720, width: 560, grain: 'vertical' }),
      piece({ partName: 'Shelf', length: 568, width: 284, grain: 'none' }),
    ];
    const layout = cutPiecesToLayout(pieces, { materialHasGrain: true });
    expect(layout.every((p) => p.grainLocked)).toBe(true);
  });

  it('only locks marked grain parts on non-grain boards', () => {
    const pieces = [
      piece({ partName: 'Side', length: 720, width: 560, grain: 'none' }),
      piece({ partName: 'Shelf', length: 568, width: 284, grain: 'none' }),
    ];
    const layout = cutPiecesToLayout(pieces, { materialHasGrain: false });
    expect(layout.every((p) => !p.grainLocked)).toBe(true);
  });

  it('nests grain-board shelves with Length along sheet grain (no rotate)', () => {
    const pieces = cutPiecesToLayout(
      [
        piece({ partName: 'Shelf', length: 568, width: 284, qty: 3, grain: 'none' }),
        piece({ partName: 'Door', length: 720, width: 400, qty: 1, grain: 'vertical' }),
      ],
      { materialHasGrain: true },
    );
    const result = layoutSheets(pieces, 2750, 1830, 4, 1);
    expect(result.unplaced).toHaveLength(0);
    const shelves = result.sheetDetails.flatMap((s) => s.placements).filter((p) => p.label.startsWith('Shelf'));
    expect(shelves.length).toBe(3);
    for (const s of shelves) {
      expect(s.widthMm).toBe(568);
      expect(s.heightMm).toBe(284);
      expect(s.grainLocked).toBe(true);
    }
  });
});
