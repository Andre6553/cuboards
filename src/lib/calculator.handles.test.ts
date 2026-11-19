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
import { createDefaultDoor, createDefaultDrawer, createDefaultUnit, generateCutList } from './calculator';
import { DEFAULT_HARDWARE_PRICING } from './hardwarePricing';
import { DEFAULT_INSTALL_RATES } from './installRules';
import { HANDLE_CATALOG } from './handleCatalog';
import { buildHardwareShoppingList, hardwareShoppingGrandTotal } from './hardwareShopping';

function testJob(): Job {
  const handleId = HANDLE_CATALOG[0]?.id;
  return {
    id: 'test-job',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    client: { name: '', ref: '', address: '', phone: '', notes: '' },
    settings: { ...DEFAULT_SETTINGS, defaultHandleId: handleId },
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
  };
}

describe('generateCutList — cabinet handles', () => {
  it('prices 1 handle per door leaf by default from job default', () => {
    const job = testJob();
    const unit = createDefaultUnit(job, 0);
    const door = createDefaultDoor(unit, job, 'mat-white');
    door.qty = 2;
    unit.doors = [door];
    unit.drawers = [];
    job.units = [unit];

    const handles = generateCutList(job).hardware.filter((h) => h.description === 'Cabinet handle');
    expect(handles).toHaveLength(1);
    expect(handles[0].qty).toBe(2);
    expect(handles[0].subtotal).toBe(handles[0].pricePerPair * 2);
  });

  it('uses handleCount 2 on doors', () => {
    const job = testJob();
    const unit = createDefaultUnit(job, 0);
    const door = createDefaultDoor(unit, job, 'mat-white');
    door.qty = 1;
    door.handleCount = 2;
    unit.doors = [door];
    unit.drawers = [];
    job.units = [unit];

    const handles = generateCutList(job).hardware.filter((h) => h.description === 'Cabinet handle');
    expect(handles).toHaveLength(1);
    expect(handles[0].qty).toBe(2);
    expect(handles[0].detail).toContain('2/door');
  });

  it('uses handleCount 3 × frontQty on drawers', () => {
    const job = testJob();
    const unit = createDefaultUnit(job, 0);
    unit.doors = [];
    const drawer = createDefaultDrawer(unit, job, 'mat-white');
    drawer.qty = 1;
    drawer.frontQty = 2;
    drawer.handleCount = 3;
    unit.drawers = [drawer];
    job.units = [unit];

    const handles = generateCutList(job).hardware.filter((h) => h.description === 'Cabinet handle');
    expect(handles).toHaveLength(1);
    expect(handles[0].qty).toBe(6);
    expect(handles[0].detail).toContain('3/front');
  });

  it('uses per-drawer override handle and adds to shopping total', () => {
    const job = testJob();
    const override = HANDLE_CATALOG[1] ?? HANDLE_CATALOG[0];
    const unit = createDefaultUnit(job, 0);
    unit.doors = [];
    const drawer = createDefaultDrawer(unit, job, 'mat-white');
    drawer.qty = 2;
    drawer.frontQty = 1;
    drawer.handle = { type: 'preset', presetId: override.id };
    unit.drawers = [drawer];
    job.units = [unit];

    const result = generateCutList(job);
    const handles = result.hardware.filter((h) => h.description === 'Cabinet handle');
    expect(handles).toHaveLength(1);
    expect(handles[0].qty).toBe(2);
    expect(handles[0].detail).toContain(override.sku ?? override.name.slice(0, 8));

    const shopping = buildHardwareShoppingList(job, result);
    const shopHandle = shopping.find((i) => i.description === 'Cabinet handle');
    expect(shopHandle?.qty).toBe(2);
    expect(shopHandle?.sku).toBe(override.sku ?? '');
    expect(hardwareShoppingGrandTotal(shopping)).toBeGreaterThanOrEqual(handles[0].subtotal);
  });

  it('skips handle lines when no job default and no override', () => {
    const job = testJob();
    job.settings.defaultHandleId = undefined;
    const unit = createDefaultUnit(job, 0);
    unit.doors = [createDefaultDoor(unit, job, 'mat-white')];
    unit.drawers = [];
    job.units = [unit];
    const handles = generateCutList(job).hardware.filter((h) => h.description === 'Cabinet handle');
    expect(handles).toHaveLength(0);
  });
});
