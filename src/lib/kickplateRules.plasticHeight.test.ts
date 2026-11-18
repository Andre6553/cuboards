import { describe, expect, it } from 'vitest';
import {
  plasticKickplateStripsToBuy,
  resolveGelmarPlasticKickplatePricePerMetre,
  snapPlasticKickplateHeight,
  summarizePlasticKickplatePurchases,
  withGelmarKickplatePrice,
} from './kickplateRules';
import { DEFAULT_PLASTIC_KICKPLATE } from './constants';
import type { PlasticKickplateLine } from '../types';

describe('plastic kickplate height helpers', () => {
  it('snaps to the nearer of 100 / 150', () => {
    expect(snapPlasticKickplateHeight(100)).toBe(100);
    expect(snapPlasticKickplateHeight(150)).toBe(150);
    expect(snapPlasticKickplateHeight(120)).toBe(100);
    expect(snapPlasticKickplateHeight(140)).toBe(150);
  });

  it('resolves Gelmar R/m from the per-height cache', () => {
    const config = withGelmarKickplatePrice(
      { ...DEFAULT_PLASTIC_KICKPLATE, pricePerMetre: 40, stripHeight: 100 },
      150,
      55,
    );
    expect(resolveGelmarPlasticKickplatePricePerMetre(config, 150)).toEqual({
      stripHeight: 150,
      pricePerMetre: 55,
    });
    expect(resolveGelmarPlasticKickplatePricePerMetre(config, 100)).toEqual({
      stripHeight: 100,
      pricePerMetre: 40,
    });
  });

  it('does not reuse the 100 mm rate for an unpriced 150 mm height', () => {
    const config = { ...DEFAULT_PLASTIC_KICKPLATE, stripHeight: 100, pricePerMetre: 40 };
    expect(resolveGelmarPlasticKickplatePricePerMetre(config, 100).pricePerMetre).toBe(40);
    expect(resolveGelmarPlasticKickplatePricePerMetre(config, 150).pricePerMetre).toBe(0);
  });
});

describe('plastic kickplate 3 m strip buy rounding', () => {
  it('ceils needed metres to whole 3 m strips', () => {
    expect(plasticKickplateStripsToBuy(0.9)).toEqual({
      neededMetres: 0.9,
      stripsToBuy: 1,
      billableMetres: 3,
    });
    expect(plasticKickplateStripsToBuy(3)).toEqual({
      neededMetres: 3,
      stripsToBuy: 1,
      billableMetres: 3,
    });
    expect(plasticKickplateStripsToBuy(3.5)).toEqual({
      neededMetres: 3.5,
      stripsToBuy: 2,
      billableMetres: 6,
    });
    expect(plasticKickplateStripsToBuy(17.89)).toEqual({
      neededMetres: 17.89,
      stripsToBuy: 6,
      billableMetres: 18,
    });
  });

  it('groups same product/height before rounding', () => {
    const lines: PlasticKickplateLine[] = [
      {
        productName: 'PVC',
        unitName: 'A',
        coverageLabel: 'Front',
        lengthMm: 2000,
        stripHeight: 100,
        stripWidth: 18,
        cupboardQty: 1,
        totalMetres: 2,
        pricePerMetre: 40,
        subtotal: 80,
      },
      {
        productName: 'PVC',
        unitName: 'B',
        coverageLabel: 'Front',
        lengthMm: 1500,
        stripHeight: 100,
        stripWidth: 18,
        cupboardQty: 1,
        totalMetres: 1.5,
        pricePerMetre: 40,
        subtotal: 60,
      },
    ];
    // 3.5 m needed → 2 × 3 m = 6 m billed (not 1.5 strips).
    expect(summarizePlasticKickplatePurchases(lines)).toEqual([
      {
        productName: 'PVC',
        stripHeight: 100,
        stripWidth: 18,
        pricePerMetre: 40,
        neededMetres: 3.5,
        stripsToBuy: 2,
        billableMetres: 6,
        subtotal: 240,
      },
    ]);
  });
});
