import { describe, expect, it } from 'vitest';
import type { BedroomWallExtra, Job, Unit } from '../types';
import { drawerBoxFrontBackWidth, drawerBoxSideDepth } from './drawerBoxRules';
import { extraBoardCuts, extraLayoutUnit, extraPartMaterialId, extrasForCutList } from './extrasRules';

function extra(partial: Partial<BedroomWallExtra> = {}): BedroomWallExtra {
  return {
    id: 'ex1',
    width: 400,
    height: 800,
    depth: 500,
    includeTop: false,
    topQty: 1,
    topLength: 368,
    topDepth: 500,
    topMaterialId: 'mat-oak',
    topEdgingPattern: '1_long',
    topEdgingMaterialId: 'edge-1',
    sideFillers: false,
    sideFillerWidth: 80,
    sideFillerHeight: 800,
    sideFillerQty: 2,
    sideFillerEdgingLongCount: 1,
    sideFillerEdgingShortCount: 0,
    topFillers: false,
    topFillerWidth: 80,
    topFillerHeight: 400,
    topFillerQty: 2,
    topFillerEdgingLongCount: 1,
    topFillerEdgingShortCount: 0,
    shelvesEnabled: false,
    shelfQty: 1,
    shelfWidth: 480,
    shelfHeight: 364,
    shelfEdgingPattern: '1_long',
    shelfEdgingMaterialId: 'edge-1',
    divisionEnabled: false,
    divisionQty: 1,
    divisionWidth: 500,
    divisionHeight: 800,
    divisionEdgingPattern: '1_long',
    divisionEdgingMaterialId: 'edge-1',
    drawersEnabled: false,
    drawers: [],
    drawerCarcassWidth: 400,
    drawerCarcassHeight: 800,
    drawerCarcassDepth: 500,
    drawerCarcassQty: 1,
    boxMaterialId: 'mat-oak',
    shelfMaterialId: 'mat-white',
    divisionMaterialId: 'mat-oak',
    fillerMaterialId: 'mat-white',
    edgingPattern: '1_long',
    edgingMaterialId: 'edge-1',
    fillerEdgingPattern: '1_long',
    fillerEdgingMaterialId: 'edge-1',
    ...partial,
  };
}

describe('extraBoardCuts', () => {
  it('always cuts two sides and a bottom, no top until ticked', () => {
    const cuts = extraBoardCuts(extra(), 0, 16, 80);
    expect(cuts.map((c) => c.partName)).toEqual([
      'Extra 1 · Side (left)',
      'Extra 1 · Side (right)',
      'Extra 1 · Bottom',
    ]);
    expect(cuts.find((c) => c.role === 'bottom')?.length).toBe(400 - 32);
    expect(cuts.find((c) => c.role === 'side')?.width).toBe(500);
    expect(cuts.find((c) => c.role === 'side')?.length).toBe(800);
  });

  it('adds top with fallbacks when includeTop is on but sizes were not saved', () => {
    const legacy = {
      ...extra({ includeTop: true }),
      topLength: undefined,
      topDepth: undefined,
      topQty: undefined,
    } as BedroomWallExtra;
    const cuts = extraBoardCuts(legacy, 0, 16, 80);
    const top = cuts.find((c) => c.role === 'top');
    expect(top).toMatchObject({ length: 400 - 32, width: 500, qty: 1 });
  });

  it('adds a user-sized top when includeTop is on', () => {
    const cuts = extraBoardCuts(
      extra({ includeTop: true, topLength: 394, topDepth: 480, topQty: 2, topEdgingPattern: '1_long_2_short' }),
      0,
      16,
      80,
    );
    const top = cuts.find((c) => c.role === 'top');
    expect(top).toMatchObject({ length: 394, width: 480, qty: 2, edgingPattern: '1_long_2_short' });
  });

  it('adds side and top fillers only when ticked', () => {
    const off = extraBoardCuts(extra(), 0, 16, 80);
    expect(off.some((c) => c.role === 'sideFiller' || c.role === 'topFiller')).toBe(false);
    const on = extraBoardCuts(
      extra({
        sideFillers: true,
        topFillers: true,
        sideFillerWidth: 60,
        sideFillerHeight: 1900,
        sideFillerQty: 3,
        sideFillerEdgingLongCount: 0,
        sideFillerEdgingShortCount: 0,
        topFillerWidth: 70,
        topFillerHeight: 1100,
        topFillerQty: 1,
        topFillerEdgingLongCount: 2,
        topFillerEdgingShortCount: 0,
      }),
      0,
      16,
      80,
    );
    expect(on.find((c) => c.role === 'sideFiller')).toMatchObject({
      width: 60,
      length: 1900,
      qty: 3,
      edgingPattern: 'none',
      longAlong: 'length',
    });
    expect(on.find((c) => c.role === 'topFiller')).toMatchObject({
      width: 70,
      length: 1100,
      qty: 1,
      edgingPattern: '2_long',
      longAlong: 'length',
    });
  });

  it('maps shelf length to cut length so 1 Long edging follows the front', () => {
    const cuts = extraBoardCuts(
      extra({ shelvesEnabled: true, shelfQty: 3, shelfWidth: 500, shelfHeight: 350 }),
      0,
      16,
      80,
    );
    const shelf = cuts.find((c) => c.role === 'shelf');
    expect(shelf).toMatchObject({ width: 350, length: 500, qty: 3, longAlong: 'length' });
  });

  it('uses typed division width and height', () => {
    const cuts = extraBoardCuts(
      extra({ divisionEnabled: true, divisionQty: 2, divisionWidth: 500, divisionHeight: 780 }),
      0,
      16,
      80,
    );
    const div = cuts.find((c) => c.role === 'division');
    expect(div).toMatchObject({ width: 500, length: 780, qty: 2, grainHint: 'vertical' });
  });

  it('keeps the chosen edging pattern and tape id on box, shelf, and division', () => {
    const cuts = extraBoardCuts(
      extra({
        includeTop: true,
        topEdgingPattern: '2_long',
        topEdgingMaterialId: 'edge-top',
        shelvesEnabled: true,
        divisionEnabled: true,
        edgingPattern: '2_long',
        edgingMaterialId: 'edge-2mm',
        shelfEdgingPattern: '1_long_2_short',
        shelfEdgingMaterialId: 'edge-1mm',
        divisionEdgingPattern: '2_long_2_short',
        divisionEdgingMaterialId: 'edge-2mm',
      }),
      0,
      16,
      80,
    );
    expect(cuts.find((c) => c.role === 'side')?.edgingMaterialId).toBe('edge-2mm');
    expect(cuts.find((c) => c.role === 'side')?.edgingPattern).toBe('2_long');
    expect(cuts.find((c) => c.role === 'shelf')?.edgingPattern).toBe('1_long_2_short');
    expect(cuts.find((c) => c.role === 'division')?.edgingPattern).toBe('2_long_2_short');
    expect(cuts.find((c) => c.role === 'top')?.edgingPattern).toBe('2_long');
    expect(cuts.find((c) => c.role === 'top')?.edgingMaterialId).toBe('edge-top');
  });
});

describe('extrasForCutList', () => {
  it('includes extras on any unit type when extrasEnabled is on', () => {
    const extraRow = extra();
    const kitchenOn = {
      type: 'kitchen_base' as const,
      carcass: { mountType: 'floor' as const },
      extrasEnabled: true,
      extras: [extraRow],
    } as Unit;
    const wallOff = {
      type: 'wall' as const,
      carcass: { mountType: 'floor' as const },
      extrasEnabled: false,
      extras: [extraRow],
    } as Unit;
    const wallOn = {
      type: 'wall' as const,
      carcass: { mountType: 'wall' as const },
      extrasEnabled: true,
      extras: [extraRow],
    } as Unit;
    expect(extrasForCutList(kitchenOn)).toHaveLength(1);
    expect(extrasForCutList(wallOff)).toEqual([]);
    expect(extrasForCutList(wallOn)).toHaveLength(1);
  });
});

describe('extraPartMaterialId', () => {
  const unit = {
    carcass: {
      leftMaterialId: 'outer-left',
      shelfMaterialId: 'outer-shelf',
      fillerMaterialId: 'outer-filler',
    },
  } as Unit;
  const job = { materials: [] } as Job;

  it('uses per-extra board ids, not outer carcass', () => {
    const ex = extra();
    expect(extraPartMaterialId(ex, unit, job, 'side')).toBe('mat-oak');
    expect(extraPartMaterialId(ex, unit, job, 'bottom')).toBe('mat-oak');
    expect(extraPartMaterialId(ex, unit, job, 'top')).toBe('mat-oak');
    expect(extraPartMaterialId(extra({ topMaterialId: 'mat-white' }), unit, job, 'top')).toBe('mat-white');
    expect(extraPartMaterialId(ex, unit, job, 'shelf')).toBe('mat-white');
    expect(extraPartMaterialId(ex, unit, job, 'division')).toBe('mat-oak');
    expect(extraPartMaterialId(ex, unit, job, 'sideFiller')).toBe('mat-white');
  });
});

describe('extra drawer carcass', () => {
  it('uses typed drawer carcass for drawer calc, not the outer extra box', () => {
    const layout = extraLayoutUnit(
      { width: 1200, height: 2400, depth: 650 } as Unit,
      extra({
        width: 1000,
        height: 2200,
        depth: 600,
        drawersEnabled: true,
        drawerCarcassWidth: 400,
        drawerCarcassHeight: 700,
        drawerCarcassDepth: 500,
      }),
    );
    expect(layout.width).toBe(400);
    expect(layout.height).toBe(700);
    expect(layout.depth).toBe(500);
    expect(layout.plinth).toBeUndefined();
    expect(layout.doors).toEqual([]);
  });

  it('sizes drawer boxes from drawer carcass minus board and runner clearance', () => {
    expect(drawerBoxFrontBackWidth(400, 16, 13)).toBe(400 - 32 - 26);
    expect(drawerBoxSideDepth(500, 5, 16)).toBe(500 - 5 - 32);
  });
});
