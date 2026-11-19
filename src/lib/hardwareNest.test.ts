import { describe, expect, it } from 'vitest';
import { nestHandleDetail } from './handleRules';
import { nestHardwareByDetail } from './hardwareNest';

describe('nestHardwareByDetail', () => {
  it('nests matching details across units (feet, hinges, corners, handles)', () => {
    expect(nestHandleDetail('Kida Handle · 1/door · SKU 8670')).toBe('Kida Handle · SKU 8670');

    const nested = nestHardwareByDetail([
      {
        description: 'Plinth Corner, Flexible, Aluminium, 100mm',
        qty: 1,
        unitName: 'tall 600 display',
        detail: 'Front + one side · 100 mm · SKU 6066',
        pricePerPair: 8,
        subtotal: 8,
      },
      {
        description: 'Cabinet adjustable foot',
        qty: 4,
        unitName: 'tall 600 display',
        detail: 'Gelmar adjustable kitchen leg · SKU 3294 · 4/cupboard',
        pricePerPair: 8,
        subtotal: 32,
      },
      {
        description: 'Cabinet hinge',
        qty: 4,
        unitName: 'tall 600 display',
        detail: 'Full overlay · Soft close · 2/door @ 718 mm H · SKU 200',
        pricePerPair: 6.3,
        subtotal: 25.2,
      },
      {
        description: 'Cabinet handle',
        qty: 2,
        unitName: 'ubove extractor',
        detail: 'Kida Handle, White · 1/door · SKU 8670',
        pricePerPair: 43,
        subtotal: 86,
      },
      {
        description: 'Cabinet adjustable foot',
        qty: 4,
        unitName: 'tall grosary unit',
        detail: 'Gelmar adjustable kitchen leg · SKU 3294 · 4/cupboard',
        pricePerPair: 8,
        subtotal: 32,
      },
      {
        description: 'Cabinet hinge',
        qty: 8,
        unitName: 'tall grosary unit',
        detail: 'Full overlay · Soft close · 2/door @ 718 mm H · SKU 200',
        pricePerPair: 6.3,
        subtotal: 50.4,
      },
      {
        description: 'Cabinet hinge',
        qty: 4,
        unitName: 'ubove extractor',
        detail: 'Full overlay · Soft close · 2/door @ 718 mm H · SKU 200',
        pricePerPair: 6.3,
        subtotal: 25.2,
      },
      {
        description: 'Plinth Corner, Flexible, Aluminium, 100mm',
        qty: 5,
        unitName: '900 -3 drawer',
        detail: 'Front + one side · 100 mm · SKU 6066',
        pricePerPair: 8,
        subtotal: 40,
      },
      {
        description: 'Cabinet adjustable foot',
        qty: 20,
        unitName: '900 -3 drawer',
        detail: 'Gelmar adjustable kitchen leg · SKU 3294 · 4/cupboard',
        pricePerPair: 8,
        subtotal: 160,
      },
      {
        description: 'Cabinet handle',
        qty: 5,
        unitName: '900 -3 drawer',
        detail: 'Kida Handle, White · 1/front · SKU 8670',
        pricePerPair: 43,
        subtotal: 215,
      },
      {
        description: 'Drawer runner pair',
        qty: 5,
        unitName: '900 -3 drawer',
        detail: '500 mm · SKU 7017',
        pricePerPair: 54,
        subtotal: 270,
      },
    ]);

    const byDesc = Object.fromEntries(
      nested.map((h) => [h.description + '|' + (h.detail.match(/SKU\s+(\S+)/)?.[1] ?? h.detail), h]),
    );

    expect(byDesc['Plinth Corner, Flexible, Aluminium, 100mm|6066']).toMatchObject({
      qty: 6,
      unitName: '—',
      subtotal: 48,
    });
    expect(byDesc['Cabinet adjustable foot|3294']).toMatchObject({
      qty: 28,
      unitName: '—',
      subtotal: 224,
    });
    expect(byDesc['Cabinet hinge|200']).toMatchObject({
      qty: 16,
      unitName: '—',
      subtotal: 100.8,
    });
    expect(byDesc['Cabinet handle|8670']).toMatchObject({
      qty: 7,
      unitName: '—',
      subtotal: 301,
      detail: 'Kida Handle, White · SKU 8670',
    });
    expect(byDesc['Drawer runner pair|7017']).toMatchObject({
      qty: 5,
      unitName: '900 -3 drawer',
    });
    expect(nested).toHaveLength(5);
  });

  it('keeps different details as separate lines', () => {
    const nested = nestHardwareByDetail([
      {
        description: 'Cabinet hinge',
        qty: 2,
        unitName: 'A',
        detail: 'Full overlay · 2/door @ 700 mm H · SKU 200',
        pricePerPair: 6.3,
        subtotal: 12.6,
      },
      {
        description: 'Cabinet hinge',
        qty: 4,
        unitName: 'B',
        detail: 'Full overlay · 2/door @ 900 mm H · SKU 200',
        pricePerPair: 6.3,
        subtotal: 25.2,
      },
    ]);
    expect(nested).toHaveLength(2);
    expect(nested[0].unitName).toBe('A');
    expect(nested[1].unitName).toBe('B');
  });
});
