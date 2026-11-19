import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './constants';
import { createDefaultUnit, generateCutList } from './calculator';
import {
  applyWallCornerDefaults,
  WALL_CORNER_DEFAULT_HEIGHT_MM,
  WALL_CORNER_DOOR1_WIDTH_MM,
  WALL_CORNER_DOOR2_WIDTH_MM,
  WALL_CORNER_PANEL_MM,
  WALL_CORNER_SIDE_DEPTH_MM,
  wallCornerDoorHeightMm,
} from './wallCornerRules';
import type { Job } from '../types';

function stubJob(): Job {
  return {
    id: 'j',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    client: { name: 'Test', ref: '', phone: '', address: '', notes: '' },
    settings: { ...DEFAULT_SETTINGS, thickness: 16 },
    materials: [
      {
        id: 'mat-white',
        name: 'White',
        colour: 'White',
        pricePerSheet: 850,
        hasGrain: false,
        edgingMaterialId: 'edge-1',
      },
    ],
    edgingMaterials: [{ id: 'edge-1', name: 'White edge', thickness: 1, pricePerMetre: 8 }],
    masonite: {
      name: 'Masonite',
      colour: 'White',
      thickness: 3,
      pricePerSheet: 200,
      sheetWidth: 2440,
      sheetHeight: 1220,
    },
    plasticKickplate: { name: 'PVC', stripHeight: 100, stripWidth: 18, pricePerMetre: 45 },
    runnerPrices: {},
    hingePrices: {},
    handlePrices: {},
    screwPrices: {},
    connectingFittingPrices: {},
    installRates: { enabled: false } as Job['installRates'],
    units: [],
  } as Job;
}

describe('wallCornerRules', () => {
  it('door height uses only top and bottom gaps', () => {
    expect(wallCornerDoorHeightMm(720, { top: 10, bottom: 0 })).toBe(710);
  });

  it('emits fixed carcass parts, three filler types, and two door widths', () => {
    const job = stubJob();
    let unit = createDefaultUnit(job, 0);
    unit = applyWallCornerDefaults(
      { ...unit, type: 'wall', height: WALL_CORNER_DEFAULT_HEIGHT_MM, name: 'Corner wall' },
      job,
    );
    job.units = [unit];

    const result = generateCutList(job);

    expect(
      result.pieces.some(
        (p) =>
          p.partName === 'Bottom' &&
          p.width === WALL_CORNER_PANEL_MM &&
          p.length === WALL_CORNER_PANEL_MM &&
          p.edgingPattern === 'none',
      ),
    ).toBe(true);
    expect(result.pieces.filter((p) => p.partName.startsWith('Shelf')).length).toBe(2);
    expect(result.pieces.some((p) => p.partName === 'Top' && p.width === WALL_CORNER_PANEL_MM)).toBe(true);
    expect(
      result.pieces.some(
        (p) =>
          p.partName === 'Side (left)' &&
          p.width === WALL_CORNER_SIDE_DEPTH_MM &&
          p.length === WALL_CORNER_DEFAULT_HEIGHT_MM,
      ),
    ).toBe(true);

    // Filler 1 length = 720 − 2×16 = 688, width 70, qty 2
    expect(
      result.pieces.some(
        (p) => p.partName === 'Filler 1' && p.length === 688 && p.width === 70 && p.qty === 2,
      ),
    ).toBe(true);
    expect(result.pieces.some((p) => p.partName === 'Filler 2' && p.length === 514 && p.qty === 2)).toBe(true);
    expect(result.pieces.some((p) => p.partName === 'Filler 3' && p.length === 498 && p.qty === 2)).toBe(true);
    expect(result.pieces.some((p) => p.partName === 'Carcass back (masonite)' && p.qty === 2)).toBe(true);

    const doors = result.pieces.filter((p) => p.partName === 'Door');
    expect(doors).toHaveLength(2);
    const doorWidths = doors.map((d) => d.width).sort((a, b) => a - b);
    expect(doorWidths).toEqual(
      [WALL_CORNER_DOOR2_WIDTH_MM, WALL_CORNER_DOOR1_WIDTH_MM].sort((a, b) => a - b),
    );
    expect(doors.every((d) => d.length === 710)).toBe(true);
  });
});
