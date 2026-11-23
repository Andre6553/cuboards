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

describe('bedroom wall carcass fillers on cut list', () => {
  it('always adds 2 top fillers as fillerWidth × (W−2T)', () => {
    const job = testJob();
    const T = job.settings.thickness;
    const unit = createDefaultUnit(job, 0);
    unit.type = 'bedroom';
    unit.width = 900;
    unit.height = 600;
    unit.depth = 350;
    unit.carcass.mountType = 'wall';
    unit.carcass.fillerWidth = 100;
    job.units = [unit];

    const { pieces } = generateCutList(job);
    const tops = pieces.filter((p) => p.partName.startsWith('Top filler'));
    expect(tops).toHaveLength(2);
    expect(tops.map((p) => p.partName).sort()).toEqual(['Top filler (back)', 'Top filler (front)']);
    for (const p of tops) {
      expect(p.width).toBe(100);
      expect(p.length).toBe(900 - 2 * T);
      expect(p.qty).toBe(1);
    }
    expect(pieces.filter((p) => p.partName === 'Side filler')).toEqual([]);
  });

  it('adds optional side/top tick-box fillers on top of the always-on 2', () => {
    const job = testJob();
    const T = job.settings.thickness;
    const unit = createDefaultUnit(job, 0);
    unit.type = 'bedroom';
    unit.width = 900;
    unit.height = 600;
    unit.depth = 350;
    unit.carcass.mountType = 'wall';
    unit.carcass.fillerWidth = 80;
    unit.carcass.sideFillers = true;
    unit.carcass.topFillers = true;
    job.units = [unit];

    const { pieces } = generateCutList(job);
    const side = pieces.find((p) => p.partName === 'Side filler');
    expect(side).toMatchObject({ width: 80, length: 600, qty: 2 });
    // Always-on front/back (W−2T) plus optional tick-box "Top filler"
    expect(pieces.filter((p) => p.partName === 'Top filler (front)' || p.partName === 'Top filler (back)')).toHaveLength(2);
    const optionalTop = pieces.find((p) => p.partName === 'Top filler');
    expect(optionalTop).toMatchObject({ width: 80, length: 900, qty: 2 });
    expect(pieces.find((p) => p.partName === 'Top filler (front)')?.length).toBe(900 - 2 * T);
  });
});
