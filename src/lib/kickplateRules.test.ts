import { describe, expect, it } from 'vitest';
import type { KitchenPlinthConfig } from '../types';
import { kickplateRunLengthMm, maxKickplateFrontRunMm, resolveKickplateFrontRunMm, woodKickplatePieces } from './kickplateRules';

function plinth(partial: Partial<KitchenPlinthConfig> = {}): KitchenPlinthConfig {
  return {
    kickplateType: 'wood',
    kickplateCoverage: 'front',
    kickplateSide: 'left',
    kickplateMaterialId: 'm',
    kickplateHeight: 120,
    feetPerUnit: 4,
    feetRequired: true,
    ...partial,
  };
}

describe('kickplate long-edge run', () => {
  it('defaults front and side runs to cupboard width and depth', () => {
    const p = plinth();
    expect(resolveKickplateFrontRunMm(600, p)).toBe(600);
    const front = woodKickplatePieces(600, 560, 120, p)[0];
    expect(front.width).toBe(600);
    expect(front.length).toBe(120);
  });

  it('uses user sizes on the cut list and plastic run total', () => {
    const sheet = { sheetWidth: 2750, sheetHeight: 1830 };
    const p = plinth({
      kickplateFrontRunMm: 580,
      kickplateSideRunMm: 540,
      kickplateCoverage: 'front-both-sides',
    });
    const front = woodKickplatePieces(600, 560, 120, p, sheet)[0];
    expect(front.width).toBe(580);
    expect(kickplateRunLengthMm(600, 560, 'front-both-sides', p, sheet)).toBe(580 + 540 + 540);
  });

  it('allows total front run beyond one sheet and splits board pieces at sheet width', () => {
    const sheet = { sheetWidth: 2750, sheetHeight: 1830 };
    const p = plinth({ kickplateFrontRunMm: 2400 });
    expect(resolveKickplateFrontRunMm(600, p, sheet)).toBe(2400);
    const parts = woodKickplatePieces(600, 560, 120, p, sheet);
    expect(parts.map((x) => x.width)).toEqual([1830, 570]);
    expect(parts.every((x) => x.length === 120)).toBe(true);
    expect(parts[0].notes).toMatch(/Join on site/);
    expect(parts[0].partName).toBe('Kickplate (front) 1/2');
  });

  it('single piece when run fits on sheet cross-grain', () => {
    const sheet = { sheetWidth: 2750, sheetHeight: 1830 };
    const p = plinth({ kickplateFrontRunMm: 1200 });
    const parts = woodKickplatePieces(600, 560, 120, p, sheet);
    expect(parts).toHaveLength(1);
    expect(parts[0].width).toBe(1200);
  });
});