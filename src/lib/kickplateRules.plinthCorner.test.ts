import { describe, expect, it } from 'vitest';
import { DEFAULT_PLASTIC_KICKPLATE } from './constants';
import { gelmarPlinthCornerProduct } from './gelmarKickplateCatalog';
import {
  normalizePlasticKickplate,
  plinthCornerQtyPerCupboard,
  resolvePlinthCornerPriceEach,
  withGelmarCornerPrice,
} from './kickplateRules';

describe('plinth corner qty + pricing', () => {
  it('maps coverage to 0 / 1 / 2 corners per cupboard', () => {
    expect(plinthCornerQtyPerCupboard('front')).toBe(0);
    expect(plinthCornerQtyPerCupboard('front-one-side')).toBe(1);
    expect(plinthCornerQtyPerCupboard('front-both-sides')).toBe(2);
  });

  it('resolves Gelmar catalog product by height', () => {
    expect(gelmarPlinthCornerProduct(100)?.sku).toBe('6066');
    expect(gelmarPlinthCornerProduct(150)?.sku).toBe('6795');
    expect(gelmarPlinthCornerProduct(120)?.sku).toBe('6066');
    expect(gelmarPlinthCornerProduct(140)?.sku).toBe('6795');
  });

  it('seeds default corner prices on normalize and resolves per height', () => {
    const normalized = normalizePlasticKickplate({ ...DEFAULT_PLASTIC_KICKPLATE });
    expect(normalized.gelmarCornerPriceEachByHeight).toEqual({ 100: 8, 150: 11 });
    expect(resolvePlinthCornerPriceEach(normalized, 100)).toEqual({ stripHeight: 100, priceEach: 8 });
    expect(resolvePlinthCornerPriceEach(normalized, 150)).toEqual({ stripHeight: 150, priceEach: 11 });
  });

  it('keeps manual corner price overrides via withGelmarCornerPrice', () => {
    const next = withGelmarCornerPrice({ ...DEFAULT_PLASTIC_KICKPLATE }, 100, 9.5);
    expect(resolvePlinthCornerPriceEach(next, 100).priceEach).toBe(9.5);
    expect(resolvePlinthCornerPriceEach(next, 150).priceEach).toBe(11);
  });
});
