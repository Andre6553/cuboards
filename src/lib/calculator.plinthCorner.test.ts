import { describe, expect, it } from 'vitest';
import type { Job } from '../types';
import {
  DEFAULT_CONNECTING_FITTING_PRICES,
  DEFAULT_EDGING,
  DEFAULT_HINGE_PRICES,
  DEFAULT_MASONITE,
  DEFAULT_MATERIALS,
  DEFAULT_PLASTIC_KICKPLATE,
  DEFAULT_RUNNER_PRICES,
  DEFAULT_SCREW_PRICES,
  DEFAULT_SETTINGS,
} from './constants';
import { createDefaultUnit, generateCutList } from './calculator';
import { DEFAULT_HARDWARE_PRICING } from './hardwarePricing';
import { DEFAULT_INSTALL_RATES } from './installRules';
import { buildHardwareShoppingList, hardwareShoppingGrandTotal } from './hardwareShopping';

function testJob(): Job {
  return {
    id: 'test-job',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    client: { name: '', ref: '', address: '', phone: '', notes: '' },
    settings: { ...DEFAULT_SETTINGS },
    materials: DEFAULT_MATERIALS.map((m) => ({ ...m })),
    edgingMaterials: DEFAULT_EDGING.map((e) => ({ ...e })),
    masonite: { ...DEFAULT_MASONITE },
    plasticKickplate: {
      ...DEFAULT_PLASTIC_KICKPLATE,
      useGelmarCatalog: true,
      gelmarCornerPriceEachByHeight: { 100: 8, 150: 11 },
    },
    runnerPrices: { ...DEFAULT_RUNNER_PRICES },
    hingePrices: { ...DEFAULT_HINGE_PRICES },
    screwPrices: { ...DEFAULT_SCREW_PRICES },
    connectingFittingPrices: { ...DEFAULT_CONNECTING_FITTING_PRICES },
    installRates: { ...DEFAULT_INSTALL_RATES },
    hardwarePricing: structuredClone(DEFAULT_HARDWARE_PRICING),
    units: [],
  };
}

function cornerLines(job: Job) {
  return generateCutList(job).hardware.filter((h) => h.description.startsWith('Plinth Corner'));
}

describe('plastic kickplate plinth corners', () => {
  it('adds no corners for front-only or wood kickplate', () => {
    const job = testJob();
    const plasticFront = createDefaultUnit(job, 0);
    const woodSide = createDefaultUnit(job, 1);
    job.units = [
      {
        ...plasticFront,
        plinth: {
          ...plasticFront.plinth!,
          kickplateType: 'plastic',
          kickplateCoverage: 'front',
          kickplateHeight: 100,
        },
      },
      {
        ...woodSide,
        plinth: {
          ...woodSide.plinth!,
          kickplateType: 'wood',
          kickplateCoverage: 'front-both-sides',
          kickplateHeight: 100,
        },
      },
    ];
    expect(cornerLines(job)).toEqual([]);
  });

  it('adds 1×100 mm corner for front + one side and 2×150 mm for both sides × qty', () => {
    const job = testJob();
    const oneSide = createDefaultUnit(job, 0);
    const both = createDefaultUnit(job, 1);
    job.units = [
      {
        ...oneSide,
        unitQty: 1,
        plinth: {
          ...oneSide.plinth!,
          kickplateType: 'plastic',
          kickplateCoverage: 'front-one-side',
          kickplateHeight: 100,
        },
      },
      {
        ...both,
        unitQty: 2,
        plinth: {
          ...both.plinth!,
          kickplateType: 'plastic',
          kickplateCoverage: 'front-both-sides',
          kickplateHeight: 150,
        },
      },
    ];

    const corners = cornerLines(job);
    expect(corners.map(({ description, qty, subtotal }) => [description, qty, subtotal])).toEqual([
      ['Plinth Corner, Flexible, Aluminium, 100mm', 1, 8],
      ['Plinth Corner, Flexible, Aluminium, 150mm', 4, 44],
    ]);
    expect(corners.every((c) => c.detail.includes('SKU'))).toBe(true);

    const result = generateCutList(job);
    const shopping = buildHardwareShoppingList(job, result);
    const shopCorners = shopping.filter((i) => i.description.startsWith('Plinth Corner'));
    expect(shopCorners.map(({ sku, qty, subtotal }) => [sku, qty, subtotal])).toEqual([
      ['6066', 1, 8],
      ['6795', 4, 44],
    ]);
    expect(hardwareShoppingGrandTotal(shopping)).toBeGreaterThanOrEqual(52);
  });
});
