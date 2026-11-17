import { describe, expect, it } from 'vitest';
import type { Unit } from '../types';
import {
  bedroomWallFillerPieces,
  carcassShelfSize,
  resolveBedroomWallSideFillerEdging,
  topFillerCount,
} from './carcassRules';

function unit(type: Unit['type'], mount: Unit['carcass']['mountType'], top: Unit['carcass']['countertopType'] = 'granite'): Pick<Unit, 'type' | 'carcass'> {
  return { type, carcass: { mountType: mount, countertopType: top } as Unit['carcass'] };
}

describe('topFillerCount', () => {
  it('uses fillers on wall units, tall floor, and kitchen wall/floor', () => {
    expect(topFillerCount(unit('wall', 'wall'))).toBe(2);
    expect(topFillerCount(unit('wall', 'wall', 'wooden'))).toBe(2);
    expect(topFillerCount(unit('kitchen_base', 'tall_floor'))).toBe(2);
    expect(topFillerCount(unit('kitchen_base', 'tall_floor', 'wooden'))).toBe(2);
    expect(topFillerCount(unit('kitchen_base', 'wall'))).toBe(2);
    expect(topFillerCount(unit('kitchen_base', 'wall', 'wooden'))).toBe(3);
    expect(topFillerCount(unit('kitchen_base', 'floor'))).toBe(2);
    expect(topFillerCount(unit('kitchen_base', 'floor', 'wooden'))).toBe(3);
  });

  it('does not add floor fillers on a bedroom wall unit', () => {
    expect(topFillerCount(unit('bedroom', 'wall'))).toBe(0);
    expect(topFillerCount(unit('bedroom', 'floor'))).toBe(2);
  });

  it('sizes bedroom wall fillers from carcass height, carcass width, and filler width', () => {
    const bedroom = {
      type: 'bedroom' as const,
      width: 1000,
      height: 2245,
      carcass: { mountType: 'wall' as const, fillerWidth: 80, sideFillers: true, topFillers: true } as Unit['carcass'],
    };
    expect(bedroomWallFillerPieces(bedroom)).toEqual({
      side: { width: 80, length: 2245, qty: 2 },
      top: { width: 80, length: 1000, qty: 2 },
    });
    expect(
      bedroomWallFillerPieces({
        ...bedroom,
        carcass: {
          ...bedroom.carcass,
          sideFillerWidth: 40,
          sideFillerHeight: 1800,
          sideFillerQty: 3,
          topFillerWidth: 55,
          topFillerHeight: 900,
          topFillerQty: 1,
        },
      }),
    ).toEqual({
      side: { width: 40, length: 1800, qty: 3 },
      top: { width: 55, length: 900, qty: 1 },
    });
    expect(bedroomWallFillerPieces({ ...bedroom, carcass: { ...bedroom.carcass, sideFillers: false, topFillers: false } })).toEqual({
      side: null,
      top: null,
    });
    expect(resolveBedroomWallSideFillerEdging(bedroom.carcass)).toEqual({ long: 1, short: 0 });
    expect(
      resolveBedroomWallSideFillerEdging({
        ...bedroom.carcass,
        sideFillerEdgingLongCount: 0,
        sideFillerEdgingShortCount: 0,
      }),
    ).toEqual({ long: 0, short: 0 });
  });
});

describe('carcassShelfSize', () => {
  it('uses full depth unless solid melamine backing', () => {
    expect(carcassShelfSize(550, 568, 16, 'masonite')).toEqual({ depth: 550, width: 568 });
    expect(carcassShelfSize(550, 568, 16, 'none')).toEqual({ depth: 550, width: 568 });
    expect(carcassShelfSize(550, 568, 16, 'melamine')).toEqual({ depth: 534, width: 568 });
  });
});
