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
import { buildPerUnitBreakdownSections } from './perUnitBreakdown';

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

describe('buildPerUnitBreakdownSections', () => {
  it('keeps each job unit row separate even when names and materials match', () => {
    const job = testJob();
    const a = createDefaultUnit(job, 0);
    const b = createDefaultUnit(job, 1);
    a.name = 'Base 600';
    b.name = 'Base 600';
    a.width = 600;
    b.width = 800;
    a.unitQty = 1;
    b.unitQty = 1;
    job.units = [a, b];

    const { pieces } = generateCutList(job);
    const sections = buildPerUnitBreakdownSections(job, pieces);

    expect(sections).toHaveLength(2);
    expect(sections[0].unitId).toBe(a.id);
    expect(sections[1].unitId).toBe(b.id);
    expect(sections[0].pieces.every((p) => p.unitId === a.id)).toBe(true);
    expect(sections[1].pieces.every((p) => p.unitId === b.id)).toBe(true);

    const bottomA = sections[0].pieces.find((p) => p.partName === 'Bottom');
    const bottomB = sections[1].pieces.find((p) => p.partName === 'Bottom');
    expect(bottomA).toBeDefined();
    expect(bottomB).toBeDefined();
    expect(bottomA!.length).not.toBe(bottomB!.length);
  });
});