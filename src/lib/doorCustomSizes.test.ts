import { describe, expect, it } from 'vitest';
import type { DoorConfig, Unit } from '../types';
import { doorPanelHeight, seedCustomDoorHeights, targetDoorOpeningHeight, usesCustomDoorSizes } from './doorRules';
import { resolveFrontLayout } from './frontLayout';

function baseDoor(partial: Partial<DoorConfig> = {}): DoorConfig {
  return {
    id: 'door1',
    qty: 1,
    materialId: 'm',
    edgingPattern: '2_long_2_short',
    edgingMaterialId: 'e',
    openingWidth: 600,
    openingHeight: 720,
    gaps: { left: 2, right: 2, top: 10, bottom: 0, between: 2 },
    hinge: { type: 'preset', presetId: 'x' },
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
    doors: [baseDoor()],
    drawers: [],
    ...partial,
  };
}

describe('custom door sizes', () => {
  it('uses typed door height when custom is on; opening = height + gaps', () => {
    const d = baseDoor({ doorHeightMm: 500, gaps: { left: 2, right: 2, top: 10, bottom: 0, between: 2 } });
    expect(doorPanelHeight(d, true)).toBe(500);
    expect(targetDoorOpeningHeight(d, 500)).toBe(510);
    expect(doorPanelHeight(d, false)).toBe(710);
  });

  it('keeps fixed door openings when custom doors + auto drawers', () => {
    const door = baseDoor({ doorHeightMm: 400, openingHeight: 999 });
    const unit = baseUnit({
      customDoorSizes: true,
      doors: [door],
      drawers: [
        {
          id: 'dr1',
          qty: 1,
          boxMaterialId: 'm',
          frontMaterialId: 'm',
          bottomType: 'masonite',
          boxHeight: 120,
          runner: { type: 'preset', presetId: 'blum-tandem' },
          openingWidth: 600,
          openingHeight: 200,
          gaps: { left: 2, right: 2, top: 2, bottom: 2, between: 2 },
          frontEdgingPattern: '2_long_2_short',
          frontEdgingMaterialId: 'e',
          boxEdgingMaterialId: 'e',
          gapToDoorMm: 2,
          sideClearance: 13,
          frontClearance: 0,
          backClearance: 25,
        },
      ],
    });
    expect(usesCustomDoorSizes(unit)).toBe(true);
    const next = resolveFrontLayout(unit);
    expect(next.doors[0].openingHeight).toBe(410); // 10 + 400 + 0
    expect(next.drawers[0].openingHeight).toBeLessThanOrEqual(720 - 410 + 0.1);
  });

  it('seeds doorHeightMm from current opening', () => {
    const seeded = seedCustomDoorHeights([baseDoor({ openingHeight: 720 })]);
    expect(seeded[0].doorHeightMm).toBe(710);
    expect(seeded[0].openingHeight).toBe(720);
  });
});
