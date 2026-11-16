import { describe, expect, it } from 'vitest';
import {
  drawerBoxFrontBackWidth,
  drawerBoxInnerSize,
  drawerBoxSideDepth,
  drawerBoxSolidBottomSize,
} from './drawerBoxRules';

describe('drawerBoxRules (Andre shop logic)', () => {
  const W = 426;
  const D = 500;
  const T = 16;
  const runner = 13;
  const back = 5;

  it('front/back width = inner carcass width − 2× runner clearance', () => {
    expect(drawerBoxFrontBackWidth(W, T, runner)).toBe(W - 2 * T - 2 * runner);
  });

  it('side depth = carcass depth − back clearance − 2× board T', () => {
    expect(drawerBoxSideDepth(D, back, T)).toBe(D - back - 2 * T);
  });

  it('masonite inner cavity deducts 2×T on depth', () => {
    const fb = drawerBoxFrontBackWidth(W, T, runner);
    const side = drawerBoxSideDepth(D, back, T);
    const inner = drawerBoxInnerSize(fb, side, T);
    expect(inner).toEqual({ width: fb - 2 * T, depth: side - 2 * T });
  });

  it('solid bottom depth matches drawer side; width is inner between front/back', () => {
    const fb = drawerBoxFrontBackWidth(W, T, runner);
    const side = drawerBoxSideDepth(D, back, T);
    const bottom = drawerBoxSolidBottomSize(fb, side, T);
    expect(bottom.depth).toBe(side);
    expect(bottom.width).toBe(fb - 2 * T);
  });
});