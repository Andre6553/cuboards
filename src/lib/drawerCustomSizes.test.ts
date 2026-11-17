import { describe, expect, it } from 'vitest';
import type { DrawerConfig, Unit } from '../types';
import {
  drawerFrontHeight,
  drawerFrontWidth,
  frontStackFit,
  frontStackOverflowWarning,
  seedCustomFrontHeights,
  usesCustomDrawerSizes,
} from './drawerRules';
import { resolveFrontLayout } from './frontLayout';

function baseDrawer(partial: Partial<DrawerConfig> = {}): DrawerConfig {
  return {
    id: 'd1',
    qty: 1,
    boxMaterialId: 'm',
    frontMaterialId: 'm',
    bottomType: 'masonite',
    boxHeight: 120,
    runner: { type: 'preset', presetId: 'blum-tandem' },
    openingWidth: 600,
    openingHeight: 400,
    gaps: { left: 2, right: 2, top: 2, bottom: 2, between: 2 },
    frontEdgingPattern: '2_long_2_short',
    frontEdgingMaterialId: 'e',
    boxEdgingMaterialId: 'e',
    gapToDoorMm: 2,
    sideClearance: 13,
    frontClearance: 0,
    backClearance: 25,
    ...partial,
  };
}

function baseUnit(partial: Partial<Unit> = {}): Unit {
  return {
    id: 'u1',
    name: 'Base',
    type: 'kitchen_base',
    width: 600,
    height: 720,
    depth: 560,
    unitQty: 1,
    carcass: { mountType: 'floor' } as Unit['carcass'],
    doors: [],
    drawers: [baseDrawer()],
    ...partial,
  };
}

describe('custom drawer front sizes', () => {
  it('uses typed front height when custom is on; width still from L/R gaps', () => {
    const d = baseDrawer({ frontHeightMm: 155, openingWidth: 600, gaps: { left: 2, right: 2, top: 2, bottom: 2, between: 2 } });
    expect(drawerFrontHeight(d, 720, [d], true)).toBe(155);
    expect(drawerFrontWidth(d)).toBe(596);
    expect(drawerFrontHeight(d, 720, [d], false)).not.toBe(155);
  });

  it('derives opening height from typed front height when custom is on (no carcass rebalance)', () => {
    const d1 = baseDrawer({
      id: 'a',
      openingHeight: 999,
      frontHeightMm: 140,
      gaps: { left: 2, right: 2, top: 2, bottom: 2, between: 2 },
    });
    const d2 = baseDrawer({
      id: 'b',
      openingHeight: 999,
      frontHeightMm: 160,
      gaps: { left: 2, right: 2, top: 2, bottom: 2, between: 2 },
    });
    const unit = baseUnit({ customDrawerSizes: true, drawers: [d1, d2], height: 720 });
    const next = resolveFrontLayout(unit);
    // top 2 + front + bottom 2
    expect(next.drawers[0].openingHeight).toBe(144);
    expect(next.drawers[1].openingHeight).toBe(164);
    expect(next.drawers[0].frontHeightMm).toBe(140);
  });

  it('warns when drawer + door openings exceed carcass height', () => {
    const drawers = [baseDrawer({ openingHeight: 400 })];
    const doors = [{ id: 'door', qty: 1, materialId: 'm', edgingPattern: '2_long_2_short' as const, edgingMaterialId: 'e', openingWidth: 600, openingHeight: 400, gaps: { left: 2, right: 2, top: 2, bottom: 2, between: 2 }, hinge: { type: 'preset' as const, presetId: 'x' } }];
    const unit = baseUnit({ customDrawerSizes: true, height: 720, drawers, doors });
    expect(usesCustomDrawerSizes(unit)).toBe(true);
    expect(frontStackFit(unit).fits).toBe(false);
    expect(frontStackOverflowWarning(unit)).toMatch(/taller than carcass/);
  });

  it('seeds frontHeightMm from auto formula', () => {
    const d = baseDrawer({ qty: 2, frontHeightMm: undefined });
    const seeded = seedCustomFrontHeights([d], 720);
    expect(seeded[0].frontHeightMm).toBeGreaterThan(0);
  });
});
