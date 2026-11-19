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
import { createDefaultDrawer, createDefaultUnit, generateCutList } from './calculator';
import { drawerBoxSideDepth } from './drawerBoxRules';
import { defaultBedroomWallExtra, extraLayoutUnit } from './extrasRules';
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

describe('generateCutList — floor carcass drawers', () => {
  it('solid bottom depth matches drawer side (same calcDrawers as bedroom extras)', () => {
    const job = testJob();
    const unit = createDefaultUnit(job, 0);
    unit.width = 426;
    unit.depth = 500;
    const drawer = createDefaultDrawer(unit, job, 'mat-white');
    drawer.bottomType = 'solid';
    drawer.qty = 1;
    unit.drawers = [drawer];
    job.units = [unit];

    const { pieces } = generateCutList(job);
    const side = pieces.find((p) => p.partName === 'Drawer side');
    const bottom = pieces.find((p) => p.partName === 'Drawer bottom (solid)');
    expect(side).toBeDefined();
    expect(bottom).toBeDefined();

    const expectedSideDepth = drawerBoxSideDepth(unit.depth, drawer.backClearance ?? 25, job.settings.thickness);
    expect(side!.width).toBe(expectedSideDepth);
    expect(bottom!.width).toBe(expectedSideDepth);

    const sideCut = formatCutListDimensions(side!.width, side!.length, side!.longAlong ?? 'width');
    const bottomCut = formatCutListDimensions(bottom!.width, bottom!.length, bottom!.longAlong ?? 'width');
    const sideLong = Number(sideCut.split(' × ')[0]);
    const bottomLong = Number(bottomCut.split(' × ')[0]);
    expect(bottomLong).toBe(sideLong);
  });
});

describe('generateCutList — extra drawer carcass qty', () => {
  it('multiplies drawer box qty by drawerCarcassQty', () => {
    const job = testJob();
    const unit = createDefaultUnit(job, 0);
    unit.type = 'bedroom';
    unit.carcass = { ...unit.carcass, mountType: 'wall' };
    unit.extrasEnabled = true;
    const extra = defaultBedroomWallExtra(unit);
    extra.drawersEnabled = true;
    extra.drawerCarcassQty = 2;
    const inner = extraLayoutUnit(unit, extra);
    const drawer = createDefaultDrawer(inner, job, 'mat-white');
    drawer.qty = 1;
    extra.drawers = [drawer];
    unit.extras = [extra];
    unit.drawers = [];
    job.units = [unit];

    const { pieces } = generateCutList(job);
    const side = pieces.find((p) => p.partName === 'Extra 1 · Drawer side');
    expect(side?.qty).toBe(4);
  });
});