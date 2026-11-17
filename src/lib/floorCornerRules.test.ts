import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './constants';
import { createDefaultUnit, generateCutList } from './calculator';
import {
  applyFloorCornerDefaults,
  FLOOR_CORNER_DEFAULT_HEIGHT_MM,
  FLOOR_CORNER_DOOR1_WIDTH_MM,
  FLOOR_CORNER_DOOR2_WIDTH_MM,
  FLOOR_CORNER_PANEL_MM,
  FLOOR_CORNER_SIDE_DEPTH_MM,
  floorCornerDoorHeightMm,
} from './floorCornerRules';
import type { Job } from '../types';

function stubJob(): Job {
  return {
    id: 'j',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    client: { name: 'Test', ref: '', phone: '', address: '', notes: '' },
    settings: { ...DEFAULT_SETTINGS },
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
    screwPrices: {},
    connectingFittingPrices: {},
    installRates: { enabled: false } as Job['installRates'],
    units: [],
  } as Job;
}

describe('floorCornerRules', () => {
  it('door height uses only top and bottom gaps', () => {
    expect(floorCornerDoorHeightMm(780, { top: 10, bottom: 0 })).toBe(770);
    expect(floorCornerDoorHeightMm(780, { top: 5, bottom: 5, left: 99, right: 99 })).toBe(770);
  });

  it('emits fixed carcass parts and two door widths on the cut list', () => {
    const job = stubJob();
    let unit = createDefaultUnit(job, 0);
    unit = applyFloorCornerDefaults(
      { ...unit, height: FLOOR_CORNER_DEFAULT_HEIGHT_MM, name: 'Corner base' },
      job,
    );
    job.units = [unit];

    const result = generateCutList(job);

    expect(
      result.pieces.some(
        (p) =>
          p.partName === 'Bottom' &&
          p.width === FLOOR_CORNER_PANEL_MM &&
          p.length === FLOOR_CORNER_PANEL_MM &&
          p.edgingPattern === 'none',
      ),
    ).toBe(true);
    expect(result.pieces.some((p) => p.partName === 'Shelf' && p.width === FLOOR_CORNER_PANEL_MM)).toBe(true);
    expect(result.pieces.some((p) => p.partName === 'Top' && p.width === FLOOR_CORNER_PANEL_MM)).toBe(true);
    expect(
      result.pieces.some(
        (p) =>
          p.partName === 'Side (left)' &&
          p.width === FLOOR_CORNER_SIDE_DEPTH_MM &&
          p.length === FLOOR_CORNER_DEFAULT_HEIGHT_MM,
      ),
    ).toBe(true);
    expect(result.pieces.some((p) => p.partName === 'Filler' && p.qty === 2)).toBe(true);
    expect(result.pieces.some((p) => p.partName === 'Carcass back (masonite)' && p.qty === 2)).toBe(true);

    const doors = result.pieces.filter((p) => p.partName === 'Door');
    expect(doors).toHaveLength(2);
    const doorWidths = doors.map((d) => d.width).sort((a, b) => a - b);
    expect(doorWidths).toEqual(
      [FLOOR_CORNER_DOOR2_WIDTH_MM, FLOOR_CORNER_DOOR1_WIDTH_MM].sort((a, b) => a - b),
    );
    expect(doors.every((d) => d.length === 770)).toBe(true);
  });
});
