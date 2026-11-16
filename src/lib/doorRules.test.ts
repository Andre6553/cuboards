import { describe, expect, it } from 'vitest';
import type { DoorConfig } from '../types';
import { DEFAULT_DOOR_GAPS, defaultHingeHoles, resolveHingeHoleCount } from './doorRules';

function door(openingHeight: number, hingeHoleCount?: number): DoorConfig {
  return {
    id: 'd',
    qty: 1,
    materialId: 'm',
    edgingPattern: '2_long_2_short',
    edgingMaterialId: 'e',
    openingWidth: 1000,
    openingHeight,
    gaps: { ...DEFAULT_DOOR_GAPS, top: 0, bottom: 0 },
    hinge: { type: 'preset', presetId: 'gelmar-200' },
    hingeHoleCount,
  };
}

describe('hinge hole count', () => {
  it('defaults to 2 up to 1200 mm and 4 above that', () => {
    expect(defaultHingeHoles(800)).toBe(2);
    expect(defaultHingeHoles(1200)).toBe(2);
    expect(defaultHingeHoles(1201)).toBe(4);
    expect(defaultHingeHoles(2243)).toBe(4);
    expect(resolveHingeHoleCount(door(1199))).toBe(2);
    expect(resolveHingeHoleCount(door(2245))).toBe(4);
  });

  it('uses the dropdown value for the priced hinge count', () => {
    expect(resolveHingeHoleCount(door(2245, 5))).toBe(5);
    expect(resolveHingeHoleCount(door(700, 3))).toBe(3);
    expect(resolveHingeHoleCount(door(2245, 9))).toBe(4);
  });
});
