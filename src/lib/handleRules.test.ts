import { describe, expect, it } from 'vitest';
import type { Job } from '../types';
import {
  DEFAULT_CONNECTING_FITTING_PRICES,
  DEFAULT_EDGING,
  DEFAULT_HANDLE_PRICES,
  DEFAULT_HINGE_PRICES,
  DEFAULT_MASONITE,
  DEFAULT_MATERIALS,
  DEFAULT_PLASTIC_KICKPLATE,
  DEFAULT_RUNNER_PRICES,
  DEFAULT_SCREW_PRICES,
  DEFAULT_SETTINGS,
} from './constants';
import { DEFAULT_HARDWARE_PRICING } from './hardwarePricing';
import { DEFAULT_INSTALL_RATES } from './installRules';
import { HANDLE_CATALOG } from './handleCatalog';
import {
  isUsingJobDefaultHandle,
  nestHandleDetail,
  resolveHandleCatalogEntry,
  resolveHandleCount,
  resolveHandlePriceEach,
  resolvePartHandle,
} from './handleRules';

function testJob(overrides: Partial<Job> = {}): Job {
  const first = HANDLE_CATALOG[0];
  return {
    id: 'test-job',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    client: { name: '', ref: '', address: '', phone: '', notes: '' },
    settings: { ...DEFAULT_SETTINGS, defaultHandleId: first?.id },
    materials: DEFAULT_MATERIALS.map((m) => ({ ...m })),
    edgingMaterials: DEFAULT_EDGING.map((e) => ({ ...e })),
    masonite: { ...DEFAULT_MASONITE },
    plasticKickplate: { ...DEFAULT_PLASTIC_KICKPLATE },
    runnerPrices: { ...DEFAULT_RUNNER_PRICES },
    hingePrices: { ...DEFAULT_HINGE_PRICES },
    handlePrices: { ...DEFAULT_HANDLE_PRICES },
    screwPrices: { ...DEFAULT_SCREW_PRICES },
    connectingFittingPrices: { ...DEFAULT_CONNECTING_FITTING_PRICES },
    installRates: { ...DEFAULT_INSTALL_RATES },
    hardwarePricing: structuredClone(DEFAULT_HARDWARE_PRICING),
    units: [],
    ...overrides,
  };
}

describe('handleRules', () => {
  it('defaults handle count to 1 and clamps to 1–3', () => {
    expect(resolveHandleCount(undefined)).toBe(1);
    expect(resolveHandleCount(2)).toBe(2);
    expect(resolveHandleCount(3)).toBe(3);
    expect(resolveHandleCount(0)).toBe(1);
    expect(resolveHandleCount(9)).toBe(1);
  });

  it('inherits job default until door/drawer overrides', () => {
    const job = testJob();
    const inherited = resolvePartHandle(undefined, job);
    expect(inherited.type).toBe('preset');
    expect(inherited.presetId).toBe(job.settings.defaultHandleId);
    expect(isUsingJobDefaultHandle(undefined)).toBe(true);

    const overrideId = HANDLE_CATALOG[1]?.id ?? HANDLE_CATALOG[0].id;
    const overridden = resolvePartHandle({ type: 'preset', presetId: overrideId }, job);
    expect(overridden.presetId).toBe(overrideId);
    expect(isUsingJobDefaultHandle({ type: 'preset', presetId: overrideId })).toBe(false);
  });

  it('resolves catalog entry and price from job default', () => {
    const job = testJob();
    const entry = resolveHandleCatalogEntry(undefined, job);
    expect(entry?.id).toBe(job.settings.defaultHandleId);
    const price = resolveHandlePriceEach(undefined, job);
    expect(price).toBe(job.handlePrices[entry!.id] ?? entry!.defaultPrice);
  });

  it('strips door/front suffixes from handle detail for nesting', () => {
    expect(nestHandleDetail('Kida Handle · 1/door · SKU 8670')).toBe('Kida Handle · SKU 8670');
    expect(nestHandleDetail('Kida Handle · 1/front · SKU 8670')).toBe('Kida Handle · SKU 8670');
  });
});
