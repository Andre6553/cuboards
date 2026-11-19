import { describe, expect, it } from 'vitest';
import { buildHardwareShoppingList, formatShoppingQty, parseSkuFromText } from './hardwareShopping';
import type { CutListResult, HardwareItem, Job } from '../types';
import { DEFAULT_PLASTIC_KICKPLATE } from './constants';

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
    expect(hinge?.subtotal).toBe(6.3 * 6);
    expect(formatShoppingQty(hinge!)).toBe('6 each');
  });

  it('nests same handle SKU even when door vs front notes differ', () => {
    const result = {
      hardware: [
        {
          description: 'Cabinet handle',
          qty: 36,
          unitName: 'A',
          detail: 'Kida Handle, White, Chrome Plated, 128mm · 1/door · SKU 8670',
          pricePerPair: 43,
          subtotal: 36 * 43,
        },
        {
          description: 'Cabinet handle',
          qty: 30,
          unitName: 'B',
          detail: 'Kida Handle, White, Chrome Plated, 128mm · 1/front · SKU 8670',
          pricePerPair: 43,
          subtotal: 30 * 43,
        },
      ],
      screws: [],
      plasticKickplatePurchases: [],
    } as unknown as CutListResult;
    const items = buildHardwareShoppingList({ id: 'j' } as Job, result);
    const handles = items.filter((i) => i.description === 'Cabinet handle');
    expect(handles).toHaveLength(1);
    expect(handles[0].qty).toBe(66);
    expect(handles[0].sku).toBe('8670');
    expect(handles[0].subtotal).toBe(66 * 43);
    expect(handles[0].notes).not.toMatch(/1\/door|1\/front/);
    expect(formatShoppingQty(handles[0])).toBe('66 each');
  });

  it('maps plinth corner hardware to Gelmar product page and image', () => {
    const result = {
      hardware: [
        {
          description: 'Plinth Corner, Flexible, Aluminium, 100mm',
          qty: 2,
          unitName: 'Base',
          detail: 'Front + both sides · 100 mm · SKU 6066',
          pricePerPair: 8,
          subtotal: 16,
        },
      ],
      screws: [],
      plasticKickplatePurchases: [],
    } as unknown as CutListResult;
    const items = buildHardwareShoppingList({ id: 'j' } as Job, result);
    const corner = items.find((i) => i.description.includes('Plinth Corner'));
    expect(corner?.sku).toBe('6066');
    expect(corner?.url).toContain('plinth-corner-flexible-aluminium-100mm');
    expect(corner?.imageUrl).toContain('6066');
    expect(corner?.qty).toBe(2);
    expect(corner?.subtotal).toBe(16);
  });

  it('adds Gelmar kickplate product page and image', () => {
    const job = {
      id: 'j',
      plasticKickplate: { ...DEFAULT_PLASTIC_KICKPLATE, useGelmarCatalog: true },
    } as Job;
    const result = {
      hardware: [],
      screws: [],
      plasticKickplatePurchases: [
        {
          productName: 'PVC kickplate strip',
          stripHeight: 100,
          stripWidth: 18,
          pricePerMetre: 37.33,
          neededMetres: 6.85,
          stripsToBuy: 3,
          billableMetres: 9,
          subtotal: 335.97,
        },
      ],
    } as unknown as CutListResult;
    const items = buildHardwareShoppingList(job, result);
    const kick = items.find((i) => i.description.includes('PVC kickplate'));
    expect(kick?.sku).toBe('6801');
    expect(kick?.url).toContain('plinth-white-100mm-x-3m');
    expect(kick?.imageUrl).toContain('6801');
    expect(kick?.notes).toContain('6.85 m needed');
    expect(kick?.subtotal).toBe(335.97);
  });
});