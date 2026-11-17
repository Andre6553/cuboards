import { describe, expect, it } from 'vitest';
import type { MasoniteConfig } from '../types';
import {
  panelFitsOnSheet,
  resolveMasoniteSheetForJob,
  resolveLargeMasoniteSheet,
  resolveSmallMasoniteSheet,
} from './masoniteSheetRules';

const masonite: MasoniteConfig = {
  name: 'Masonite backing',
  colour: 'Brown',
  thickness: 3,
  pricePerSheet: 120,
  sheetWidth: 2440,
  sheetHeight: 1220,
  largePricePerSheet: 475,
  largeSheetWidth: 2750,
  largeSheetHeight: 1830,
  largeColour: 'White',
  largeThickness: 4,
  largeSheetPurchaseUnit: 'half',
  largeOrderFromSupplier: 'Big Cut House',
  sheetPurchaseUnit: 'quarter',
  orderFromSupplier: 'Small Cut House',
};

describe('resolveMasoniteSheetForJob', () => {
  it('picks small when area fits and panels fit', () => {
    const pieces = [{ width: 600, length: 700, qty: 1 }];
    const picked = resolveMasoniteSheetForJob(masonite, pieces, [
      { height: 720, carcass: { backingType: 'masonite' } as never },
    ]);
    expect(picked.label).toBe('small');
    expect(picked.width).toBe(2440);
    expect(picked.height).toBe(1220);
    expect(picked.pricePerSheet).toBe(120);
    expect(picked.colour).toBe('Brown');
    expect(picked.thickness).toBe(3);
    expect(picked.sheetPurchaseUnit).toBe('quarter');
    expect(picked.orderFromSupplier).toBe('Small Cut House');
  });

  it('picks large when total area exceeds small sheet area', () => {
    const smallArea = 2440 * 1220;
    // One piece larger than small sheet area but that still "fits" dimensionally on large
    const pieces = [{ width: 2000, length: Math.ceil(smallArea / 2000) + 10, qty: 1 }];
    const picked = resolveMasoniteSheetForJob(masonite, pieces, []);
    expect(picked.label).toBe('large');
    expect(picked.pricePerSheet).toBe(475);
    expect(picked.reason).toMatch(/area exceeds/);
    expect(picked.colour).toBe('White');
    expect(picked.thickness).toBe(4);
    expect(picked.sheetPurchaseUnit).toBe('half');
    expect(picked.orderFromSupplier).toBe('Big Cut House');
  });

  it('falls back large identity to small when large fields omitted', () => {
    const legacy: MasoniteConfig = {
      name: 'Masonite',
      colour: 'Brown',
      thickness: 3,
      pricePerSheet: 120,
      sheetWidth: 2440,
      sheetHeight: 1220,
      sheetPurchaseUnit: 'quarter',
      orderFromSupplier: 'Legacy House',
    };
    const pieces = [{ width: 2441, length: 100, qty: 1 }];
    const picked = resolveMasoniteSheetForJob(legacy, pieces, []);
    expect(picked.label).toBe('large');
    expect(picked.colour).toBe('Brown');
    expect(picked.thickness).toBe(3);
    expect(picked.sheetPurchaseUnit).toBe('quarter');
    expect(picked.orderFromSupplier).toBe('Legacy House');
  });

  it('picks large when cupboard taller than small long side', () => {
    const pieces = [{ width: 600, length: 700, qty: 1 }];
    const picked = resolveMasoniteSheetForJob(masonite, pieces, [
      { height: 2500, carcass: { backingType: 'masonite' } as never },
    ]);
    expect(picked.label).toBe('large');
    expect(picked.reason).toMatch(/taller than small sheet/);
  });

  it('picks large when a panel does not fit on small sheet', () => {
    // Long and thin: area still under small sheet, but neither orientation fits 2440×1220.
    const pieces = [{ width: 2441, length: 100, qty: 1 }];
    expect(panelFitsOnSheet(2441, 100, 2440, 1220)).toBe(false);
    const picked = resolveMasoniteSheetForJob(masonite, pieces, []);
    expect(picked.label).toBe('large');
    expect(picked.reason).toMatch(/does not fit/);
  });

  it('uses large defaults when large fields omitted', () => {
    const legacy: MasoniteConfig = {
      name: 'Masonite',
      colour: 'Brown',
      thickness: 3,
      pricePerSheet: 120,
      sheetWidth: 2440,
      sheetHeight: 1220,
    };
    expect(resolveSmallMasoniteSheet(legacy)).toEqual({
      width: 2440,
      height: 1220,
      pricePerSheet: 120,
    });
    expect(resolveLargeMasoniteSheet(legacy)).toEqual({
      width: 2750,
      height: 1830,
      pricePerSheet: 475,
    });
  });
});
