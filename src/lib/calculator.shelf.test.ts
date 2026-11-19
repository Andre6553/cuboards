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
import { formatCutListDimensions } from './edgingCutSize';
import { DEFAULT_HARDWARE_PRICING } from './hardwarePricing';
import { DEFAULT_INSTALL_RATES } from './installRules';

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
    plasticKickplate: { ...DEFAULT_PLASTIC_KICKPLATE },
    runnerPrices: { ...DEFAULT_RUNNER_PRICES },
    hingePrices: { ...DEFAULT_HINGE_PRICES },
    handlePrices: {},
    screwPrices: { ...DEFAULT_SCREW_PRICES },
    connectingFittingPrices: { ...DEFAULT_CONNECTING_FITTING_PRICES },
    installRates: { ...DEFAULT_INSTALL_RATES },
    hardwarePricing: structuredClone(DEFAULT_HARDWARE_PRICING),
    units: [],
  };
}

describe('carcass shelf with melamine backing', () => {
  it('cuts shelf as internalW × (D−T)', () => {
    const job = testJob();
    const T = job.settings.thickness;
    const unit = createDefaultUnit(job, 0);
    unit.width = 600;
    unit.depth = 500;
    unit.height = 780;
    unit.unitQty = 1;
    unit.carcass.backingType = 'melamine';
    unit.carcass.shelfQty = 1;
    job.units = [unit];

    const { pieces } = generateCutList(job);
    const shelf = pieces.find((p) => p.partName === 'Shelf 1');
    expect(shelf).toBeDefined();

    const internalW = unit.width - 2 * T;
    const shelfDepth = unit.depth - T;
    expect(shelf!.width).toBe(shelfDepth);
    expect(shelf!.length).toBe(internalW);

    const cutListSize = formatCutListDimensions(shelf!.width, shelf!.length, shelf!.longAlong ?? 'length');
    expect(cutListSize).toBe(`${internalW} × ${shelfDepth}`);
  });
});
describe('custom plastic kickplate pricing', () => {
  it('costs each unit at its selected rate and falls back when its product is removed or Gelmar is enabled', () => {
    const job = testJob();
    job.plasticKickplate = {
      ...job.plasticKickplate,
      name: 'Default strip',
      pricePerMetre: 25,
      useGelmarCatalog: false,
      customProducts: [{ id: 'tall', name: 'Tall strip', stripHeight: 150, stripWidth: 12, pricePerMetre: 60 }],
    };
    job.units = [undefined, 'tall', 'removed'].map((plasticKickplateProductId, index) => {
      const unit = createDefaultUnit(job, index);
      return {
        ...unit,
        width: 1000,
        plinth: { ...unit.plinth!, kickplateType: 'plastic', plasticKickplateProductId },
      };
    });

    const result = generateCutList(job);
    // Unit rows stay needed × R/m (1 m each).
    expect(result.plasticKickplates.map(({ productName, subtotal }) => [productName, subtotal])).toEqual([
      ['Default strip', 25], ['Tall strip', 60], ['Default strip', 25],
    ]);
    // Quote buys whole 3 m strips: 2 m Default → 1×3 m @ 25; 1 m Tall → 1×3 m @ 60.
    expect(result.plasticKickplatePurchases.map(({ productName, stripsToBuy, billableMetres, subtotal }) => [
      productName, stripsToBuy, billableMetres, subtotal,
    ])).toEqual([
      ['Default strip', 1, 3, 75],
      ['Tall strip', 1, 3, 180],
    ]);
    expect(result.costs.filter(({ name }) => name.endsWith('strip')).map(({ subtotal }) => subtotal)).toEqual([75, 180]);

    job.plasticKickplate.useGelmarCatalog = true;
    // Default plinth height snaps to 100 mm → uses job default / seeded 100 mm rate.
    expect(generateCutList(job).plasticKickplates.map(({ subtotal }) => subtotal)).toEqual([25, 25, 25]);
  });

  it('prices Gelmar plastic lines from each unit’s 100/150 height cache', () => {
    const job = testJob();
    job.plasticKickplate = {
      ...job.plasticKickplate,
      useGelmarCatalog: true,
      stripHeight: 100,
      pricePerMetre: 40,
      gelmarPricePerMetreByHeight: { 100: 40, 150: 55 },
    };
    job.units = [100, 150].map((kickplateHeight, index) => {
      const unit = createDefaultUnit(job, index);
      return {
        ...unit,
        width: 1000,
        plinth: { ...unit.plinth!, kickplateType: 'plastic', kickplateHeight },
      };
    });

    const result = generateCutList(job);
    expect(result.plasticKickplates.map(({ stripHeight, pricePerMetre, subtotal }) => [stripHeight, pricePerMetre, subtotal])).toEqual([
      [100, 40, 40],
      [150, 55, 55],
    ]);
    // 1 m of each height → buy 1 × 3 m strip per height.
    expect(result.plasticKickplatePurchases.map(({ stripHeight, stripsToBuy, subtotal }) => [
      stripHeight, stripsToBuy, subtotal,
    ])).toEqual([
      [100, 1, 120],
      [150, 1, 165],
    ]);
  });

  it('rounds job plastic kickplate buy-up to whole 3 m strips (not fractional metres)', () => {
    const job = testJob();
    job.plasticKickplate = {
      ...job.plasticKickplate,
      name: 'PVC kickplate strip',
      useGelmarCatalog: true,
      stripHeight: 100,
      pricePerMetre: 37.333333,
      gelmarPricePerMetreByHeight: { 100: 37.333333, 150: 64.666667 },
    };
    const short = createDefaultUnit(job, 0);
    const long = createDefaultUnit(job, 1);
    // 900 mm @ 150 → 0.90 m needed → 1 × 3 m strip.
    // 10 × 1789 mm @ 100 → 17.89 m needed → 6 × 3 m = 18.00 m.
    job.units = [
      {
        ...short,
        width: 900,
        unitQty: 1,
        plinth: { ...short.plinth!, kickplateType: 'plastic', kickplateHeight: 150 },
      },
      {
        ...long,
        width: 1789,
        unitQty: 10,
        plinth: { ...long.plinth!, kickplateType: 'plastic', kickplateHeight: 100 },
      },
    ];

    const result = generateCutList(job);
    expect(result.plasticKickplates.map(({ stripHeight, totalMetres }) => [stripHeight, Number(totalMetres.toFixed(2))])).toEqual([
      [150, 0.9],
      [100, 17.89],
    ]);
    expect(result.plasticKickplatePurchases.map(({ stripHeight, neededMetres, stripsToBuy, billableMetres }) => [
      stripHeight,
      Number(neededMetres.toFixed(2)),
      stripsToBuy,
      billableMetres,
    ])).toEqual([
      [150, 0.9, 1, 3],
      [100, 17.89, 6, 18],
    ]);
    const kickCosts = result.costs.filter((c) => c.name === 'PVC kickplate strip');
    expect(kickCosts.map(({ quantity, detail }) => [quantity, detail.includes('buy')])).toEqual([
      [1, true],
      [6, true],
    ]);
  });
});
