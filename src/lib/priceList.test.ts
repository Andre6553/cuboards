import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from './constants';
import { applyPriceListToJob, type PriceList } from './priceList';
import { setUserDataScope } from './userDataScope';
import type { Job } from '../types';

beforeAll(() => {
  setUserDataScope('vitest-user');
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  });
});

function stubJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'j',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    client: { name: 'Test', ref: '', phone: '', address: '', notes: '' },
    settings: { ...DEFAULT_SETTINGS, pricePerFoot: 25, sheetWidth: 2750, sheetHeight: 1830 },
    materials: [{ id: 'mat-white', name: 'White', colour: 'White', pricePerSheet: 850, hasGrain: false }],
    edgingMaterials: [{ id: 'edge-white-1', name: 'White edge', thickness: 0.4, pricePerMetre: 8 }],
    masonite: { name: 'Masonite', colour: 'White', thickness: 3, pricePerSheet: 200, sheetWidth: 2440, sheetHeight: 1220 },
    plasticKickplate: { name: 'PVC', stripHeight: 100, stripWidth: 18, pricePerMetre: 45 },
    runnerPrices: {},
    hingePrices: {},
    screwPrices: {},
    connectingFittingPrices: {},
    installRates: { enabled: false } as Job['installRates'],
    units: [],
    ...overrides,
  } as Job;
}

describe('applyPriceListToJob', () => {
  it('applies saved job settings including plastic foot price', () => {
    const job = stubJob({ settings: { ...DEFAULT_SETTINGS, pricePerFoot: 25 } });
    const list: PriceList = {
      savedAt: '2026-01-02',
      settings: { ...DEFAULT_SETTINGS, pricePerFoot: 42, sheetWidth: 3600, sheetHeight: 1800 },
      materials: job.materials,
      edgingMaterials: job.edgingMaterials,
      masonite: job.masonite,
      plasticKickplate: job.plasticKickplate,
      runnerPrices: {},
      hingePrices: {},
      screwPrices: {},
      connectingFittingPrices: {},
      installRates: job.installRates,
      quoteTerms: { validityDays: 14, depositPercent: 40, paymentNote: 'EFT', extraNotes: '' },
    };
    const out = applyPriceListToJob(job, list);
    expect(out.settings.pricePerFoot).toBe(42);
    expect(out.settings.sheetWidth).toBe(3600);
    expect(out.quoteTerms?.validityDays).toBe(14);
  });
});