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
    expect(result.plasticKickplates.map(({ productName, subtotal }) => [productName, subtotal])).toEqual([
      ['Default strip', 25], ['Tall strip', 60], ['Default strip', 25],
    ]);
    expect(result.costs.filter(({ name }) => name.endsWith('strip')).map(({ subtotal }) => subtotal)).toEqual([50, 60]);

    job.plasticKickplate.useGelmarCatalog = true;
    expect(generateCutList(job).plasticKickplates.map(({ subtotal }) => subtotal)).toEqual([25, 25, 25]);
  });
});
