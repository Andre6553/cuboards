import { describe, expect, it } from 'vitest';
import { layoutSheets, type LayoutPiece } from './sheetLayout';

describe('layoutSheets orientation', () => {
  it('prefers flatter orientation for rotatable tall panels so leftovers pack on fewer sheets', () => {
    // Mimics Esperanza: one non-grain 780×1810 panel plus a thin filler.
    // Old tie-break kept the panel standing (1810 cross) and opened a 3rd sheet
    // for the 35 mm filler even though sheet 1 looked half empty.
    const pieces: LayoutPiece[] = [
      { length: 780, width: 1810, qty: 1, grainLocked: false, label: 'Tall panel' },
      { length: 256, width: 796, qty: 3, grainLocked: true, label: 'Drawer front' },
      { length: 780, width: 745, qty: 1, grainLocked: false, label: 'Panel' },
      { length: 190, width: 496, qty: 4, grainLocked: true, label: 'Small front' },
      { length: 770, width: 594, qty: 1, grainLocked: true, label: 'Door' },
      { length: 780, width: 550, qty: 2, grainLocked: true, label: 'Side' },
      { length: 780, width: 500, qty: 1, grainLocked: true, label: 'Side 1000' },
      { length: 770, width: 497, qty: 2, grainLocked: true, label: 'Door 1000' },
      { length: 770, width: 446, qty: 1, grainLocked: true, label: 'Door 450' },
      { length: 770, width: 372, qty: 2, grainLocked: true, label: 'Door 750' },
      { length: 968, width: 100, qty: 2, grainLocked: false, label: 'Filler 1000' },
      { length: 768, width: 100, qty: 2, grainLocked: false, label: 'Filler 800' },
      { length: 568, width: 100, qty: 3, grainLocked: false, label: 'Filler 600' },
      { length: 780, width: 60, qty: 1, grainLocked: false, label: 'Filler 60' },
      { length: 780, width: 50, qty: 2, grainLocked: false, label: 'Filler 50' },
      { length: 780, width: 35, qty: 1, grainLocked: false, label: 'Filler 35' },
    ];

    const result = layoutSheets(pieces, 2750, 1830, 4, 1);
    expect(result.sheetsUsed).toBeLessThanOrEqual(2);
    expect(result.unplaced).toHaveLength(0);

    const tall = result.sheetDetails
      .flatMap((s) => s.placements)
      .find((p) => p.label === 'Tall panel');
    expect(tall).toBeDefined();
    // Cross-grain side should be the short edge (780), not 1810.
    expect(tall!.heightMm).toBe(780);
    expect(tall!.widthMm).toBe(1810);
  });
});
