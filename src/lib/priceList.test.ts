import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from './constants';
import { loadMaterialCatalog } from './materialCatalog';
import { applyPriceListToJob, loadPriceList, saveDefaultsAcrossJobs, type PriceList } from './priceList';
import { setUserDataScope } from './userDataScope';
import type { Job } from '../types';

beforeEach(() => {
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

  it('keeps job-only boards when price list has fewer types', () => {
    const job = stubJob({
      materials: [
        { id: 'mat-white', name: 'White', colour: 'White', pricePerSheet: 850, hasGrain: false },
        { id: 'mat-oak', name: 'Oak', colour: 'Oak', pricePerSheet: 1200, hasGrain: true },
      ],
    });
    const list: PriceList = {
      savedAt: '2026-01-02',
      settings: { ...DEFAULT_SETTINGS, pricePerFoot: 50 },
      materials: [{ id: 'mat-white', name: 'White', colour: 'White', pricePerSheet: 900, hasGrain: false }],
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
    expect(out.materials.map((m) => m.id).sort()).toEqual(['mat-oak', 'mat-white'].sort());
    expect(out.materials.find((m) => m.id === 'mat-white')?.pricePerSheet).toBe(900);
    expect(out.materials.find((m) => m.id === 'mat-oak')?.name).toBe('Oak');
  });
});

describe('saveDefaultsAcrossJobs', () => {
  it('enriches a thin job, updates settings on all jobs, and never drops boards', () => {
    const thin = stubJob({
      id: 'thin',
      settings: { ...DEFAULT_SETTINGS, pricePerFoot: 99 },
      materials: [{ id: 'mat-white', name: 'White', colour: 'White', pricePerSheet: 777, hasGrain: false }],
    });
    const rich = stubJob({
      id: 'rich',
      settings: { ...DEFAULT_SETTINGS, pricePerFoot: 10 },
      materials: [
        { id: 'mat-white', name: 'White', colour: 'White', pricePerSheet: 850, hasGrain: false },
        { id: 'mat-oak', name: 'Oak', colour: 'Oak', pricePerSheet: 1200, hasGrain: true },
      ],
      client: { name: 'Keep me', ref: 'R1', phone: '', address: '', notes: '' },
      units: [{ id: 'u1', name: 'Base', unitQty: 1 } as Job['units'][number]],
    });

    const { jobs, currentJob, priceList } = saveDefaultsAcrossJobs([thin, rich], thin);

    expect(currentJob.materials.map((m) => m.id).sort()).toEqual(['mat-oak', 'mat-white'].sort());
    expect(currentJob.materials.find((m) => m.id === 'mat-white')?.pricePerSheet).toBe(777);

    const richOut = jobs.find((j) => j.id === 'rich')!;
    expect(richOut.settings.pricePerFoot).toBe(99);
    expect(richOut.materials.map((m) => m.id).sort()).toEqual(['mat-oak', 'mat-white'].sort());
    expect(richOut.materials.find((m) => m.id === 'mat-white')?.pricePerSheet).toBe(777);
    expect(richOut.client.name).toBe('Keep me');
    expect(richOut.units).toHaveLength(1);

    expect(loadPriceList()?.settings.pricePerFoot).toBe(99);
    expect(priceList.materials.map((m) => m.id).sort()).toEqual(['mat-oak', 'mat-white'].sort());
    expect(loadMaterialCatalog()?.materials.map((m) => m.id).sort()).toEqual(['mat-oak', 'mat-white'].sort());
  });
});