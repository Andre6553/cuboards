import { describe, expect, it } from 'vitest';
import { billedFractionLabel, layoutSheets, paidRegionForSheet, type LayoutPiece } from './sheetLayout';

describe('layoutSheets Buy as packing', () => {
  it('packs into the first purchase step before spilling further across the sheet', () => {
    // ¼ of 2750×1830 ≈ 1.26e6 mm². Four 600×400 panels ≈ 0.96e6 — fit in first ¼
    // if packed compactly toward the origin (not spread down the full sheet).
    const pieces: LayoutPiece[] = [
      { length: 600, width: 400, qty: 4, grainLocked: true, label: 'Panel' },
    ];
    const quarter = layoutSheets(pieces, 2750, 1830, 4, 0.25);
    expect(quarter.unplaced).toHaveLength(0);
    expect(quarter.sheetsUsed).toBe(1);
    expect(quarter.sheetsToOrder).toBe(0.25);
    expect(quarter.sheetDetails[0].paidRegion.billedFraction).toBe(0.25);

    const half = layoutSheets(pieces, 2750, 1830, 4, 0.5);
    expect(half.sheetsToOrder).toBe(0.5);
    expect(half.sheetDetails[0].paidRegion.billedFraction).toBe(0.5);
  });
});

describe('paidRegionForSheet / Buy as overlay', () => {
  it('labels common Buy as fractions', () => {
    expect(billedFractionLabel(1)).toBe('Paying · full sheet');
    expect(billedFractionLabel(0.25)).toBe('Paying · ¼ sheet');
    expect(billedFractionLabel(0.5)).toBe('Paying · ½ sheet');
    expect(billedFractionLabel(1 / 3)).toBe('Paying · ⅓ sheet');
  });

  it('grows the used box to the billed fraction and covers full sheets', () => {
    const quarter = paidRegionForSheet(2750, 1830, 800, 400, 0.25);
    expect(quarter.label).toBe('Paying · ¼ sheet');
    expect(quarter.widthMm * quarter.heightMm).toBeGreaterThanOrEqual(0.25 * 2750 * 1830 - 1);
    expect(quarter.widthMm).toBeGreaterThanOrEqual(800);
    expect(quarter.heightMm).toBeGreaterThanOrEqual(400);

    const full = paidRegionForSheet(2750, 1830, 500, 500, 1);
    expect(full.widthMm).toBe(2750);
    expect(full.heightMm).toBe(1830);
  });

  it('attaches a paid region on every nested sheet', () => {
    const result = layoutSheets(
      [{ length: 500, width: 300, qty: 1, grainLocked: false, label: 'Panel' }],
      2750,
      1830,
      4,
      0.25,
    );
    expect(result.sheetDetails).toHaveLength(1);
    expect(result.sheetDetails[0].paidRegion.billedFraction).toBe(0.25);
    expect(result.sheetDetails[0].paidRegion.label).toMatch(/¼ sheet/);
  });
});

describe('layoutSheets strip packing', () => {
  it('fills earlier-sheet strip remnants before opening a new sheet (grain kept)', () => {
    // Mimics Nordic ice: tall doors open sheet 2; shelves must use sheet-1 remnant, not sheet 3.
    const pieces: LayoutPiece[] = [
      { length: 770, width: 446, qty: 1, grainLocked: true, label: 'Door tall' },
      { length: 1010, width: 372, qty: 2, grainLocked: true, label: 'Door mid' },
      { length: 1010, width: 296, qty: 1, grainLocked: true, label: 'Door 300' },
      { length: 568, width: 284, qty: 5, grainLocked: false, label: 'Shelf' },
    ];
    // Narrow cross so sheet 1 leftover end can take shelves but bottom free height cannot.
    const result = layoutSheets(pieces, 2750, 900, 4, 1);
    expect(result.unplaced).toHaveLength(0);
    const shelves = result.sheetDetails.flatMap((s) =>
      s.placements.filter((p) => p.label === 'Shelf').map((p) => ({ sheet: s.sheetIndex, ...p })),
    );
    expect(shelves.length).toBe(5);
    // At least some shelves should sit on sheet 1 remnant beside the tall door, not all on a late sheet.
    const onSheet1 = shelves.filter((p) => p.sheet === 1);
    expect(onSheet1.length).toBeGreaterThan(0);
    for (const s of onSheet1) {
      // Grain along length: 568 wide (or rotated 284) — never break grain-locked doors above.
      expect(s.heightMm === 284 || s.widthMm === 284).toBe(true);
    }
  });

  it('tucks a near-height shelf into a door-strip remnant instead of a new row', () => {
    // Nordic Ice sheet 10: two 1010×296 doors leave ~722×296; shelves are 568×284.
    const pieces: LayoutPiece[] = [
      { length: 1010, width: 296, qty: 2, grainLocked: true, label: 'Door 300' },
      { length: 568, width: 284, qty: 5, grainLocked: true, label: 'Shelf' },
    ];
    const result = layoutSheets(pieces, 2750, 1830, 4, 1);
    expect(result.unplaced).toHaveLength(0);
    expect(result.sheetsUsed).toBe(1);

    const doors = result.sheetDetails[0].placements.filter((p) => p.label === 'Door 300');
    const shelves = result.sheetDetails[0].placements.filter((p) => p.label === 'Shelf');
    expect(doors).toHaveLength(2);
    expect(shelves).toHaveLength(5);

    const doorY = doors[0].y;
    const shelvesInDoorStrip = shelves.filter((p) => p.y === doorY);
    expect(shelvesInDoorStrip.length).toBeGreaterThanOrEqual(1);
    for (const s of shelvesInDoorStrip) {
      expect(s.widthMm).toBe(568);
      expect(s.heightMm).toBe(284);
    }
  });

  it('keeps short fillers in their own rip strips so tall strips are not wasted', () => {
    const pieces: LayoutPiece[] = [
      { length: 700, width: 300, qty: 3, grainLocked: false, label: 'Panel 300' },
      { length: 600, width: 100, qty: 6, grainLocked: false, label: 'Filler 100' },
    ];
    const result = layoutSheets(pieces, 2750, 1830, 4, 1);
    expect(result.unplaced).toHaveLength(0);

    const panels = result.sheetDetails.flatMap((s) => s.placements).filter((p) => p.label === 'Panel 300');
    const fillers = result.sheetDetails.flatMap((s) => s.placements).filter((p) => p.label === 'Filler 100');
    expect(panels.length).toBe(3);
    expect(fillers.length).toBe(6);

    const panelYs = new Set(panels.map((p) => p.y));
    for (const f of fillers) {
      expect(panelYs.has(f.y)).toBe(false);
      expect(f.heightMm).toBe(100);
    }

    // Fillers share contiguous same-height bands (no tall-strip gaps between them).
    const fillerYs = [...new Set(fillers.map((p) => p.y))].sort((a, b) => a - b);
    for (let i = 1; i < fillerYs.length; i++) {
      expect(fillerYs[i] - fillerYs[i - 1]).toBe(104); // 100 + 4 kerf
    }

    const biggestOffcut = result.offcuts[0];
    expect(biggestOffcut).toBeDefined();
    expect(biggestOffcut!.areaMm2).toBeGreaterThan(600 * 100 * 4);
  });

  it('labels offcut rectangles on the sheet map', () => {
    const pieces: LayoutPiece[] = [
      { length: 500, width: 300, qty: 1, grainLocked: false, label: 'Panel' },
    ];
    const result = layoutSheets(pieces, 2750, 1830, 4, 1);
    const labels = result.sheetDetails[0]?.offcutRects.map((r) => r.label) ?? [];
    expect(labels.length).toBeGreaterThan(0);
    expect(labels[0]).toMatch(/^Offcut 1 · /);
  });
});

describe('layoutSheets orientation', () => {
  it('keeps Length along sheet grain when every part is grain-locked', () => {
    const pieces: LayoutPiece[] = [
      { length: 568, width: 284, qty: 4, grainLocked: true, label: 'Shelf' },
      { length: 780, width: 1810, qty: 1, grainLocked: true, label: 'Tall panel' },
    ];
    const result = layoutSheets(pieces, 2750, 1830, 4, 1);
    expect(result.unplaced).toHaveLength(0);
    const tall = result.sheetDetails.flatMap((s) => s.placements).find((p) => p.label === 'Tall panel');
    expect(tall).toBeDefined();
    expect(tall!.widthMm).toBe(780);
    expect(tall!.heightMm).toBe(1810);
    for (const s of result.sheetDetails.flatMap((s) => s.placements).filter((p) => p.label === 'Shelf')) {
      expect(s.widthMm).toBe(568);
      expect(s.heightMm).toBe(284);
    }
  });

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
