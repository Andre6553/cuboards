import { describe, expect, it } from 'vitest';
import { buildHardwareShoppingList, formatShoppingQty, parseSkuFromText } from './hardwareShopping';
import type { CutListResult, HardwareItem, Job } from '../types';

describe('hardware shopping list', () => {
  it('reads SKU from hinge detail', () => {
    expect(parseSkuFromText('Soft close · SKU 200 · 2/door')).toBe('200');
  });

  it('consolidates the same hinge SKU across units', () => {
    const h = (unitName: string, qty: number): HardwareItem => ({
      description: 'Cabinet hinge',
      qty,
      unitName,
      detail: 'Soft close full overlay · SKU 200',
      pricePerPair: 6.3,
      subtotal: 6.3 * qty,
    });
    const result = {
      hardware: [h('600 kas', 2), h('800 kas', 4)],
      screws: [],
    } as unknown as CutListResult;
    const items = buildHardwareShoppingList({ id: 'j' } as Job, result);
    const hinge = items.find((i) => i.description === 'Cabinet hinge');
    expect(hinge?.qty).toBe(6);
    expect(hinge?.sku).toBe('200');
    expect(hinge?.supplier).toBe('Gelmar');
    expect(formatShoppingQty(hinge!)).toBe('6 each');
  });
});