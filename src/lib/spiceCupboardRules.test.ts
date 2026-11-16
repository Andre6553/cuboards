import { describe, expect, it } from 'vitest';
import { calcSpiceCupboardSizes, defaultSpiceCupboardConfig, resolveSpiceFrontHeightMm } from './spiceCupboardRules';

describe('spiceCupboardRules', () => {
  it('defaults front height to 600 capped by carcass', () => {
    expect(defaultSpiceCupboardConfig(780).frontHeightMm).toBe(600);
    expect(defaultSpiceCupboardConfig(500).frontHeightMm).toBe(500);
    expect(resolveSpiceFrontHeightMm({ frontHeightMm: 700 }, 650)).toBe(650);
  });

  it('sizes spice panels for a typical base', () => {
    const s = calcSpiceCupboardSizes(1100, 780, 550, 16, defaultSpiceCupboardConfig(780));
    // 1100 - 32 - 26 = 1042
    expect(s.frontWidth).toBe(1042);
    expect(s.frontHeight).toBe(600);
    expect(s.splitWidth).toBe(550 - 32);
    expect(s.splitHeight).toBe(600 - 16);
    expect(s.bottomDepth).toBe(550 - 16);
    expect(s.shelfWidth).toBe((1042 - 16) / 2);
    expect(s.fillerHeight).toBe(100);
    expect(s.fillerWidth).toBe(1042);
  });
});
