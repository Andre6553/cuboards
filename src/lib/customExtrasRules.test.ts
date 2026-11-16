import { describe, expect, it } from 'vitest';
import type { CustomExtraPart, Job, Unit } from '../types';
import { DEFAULT_EDGING, DEFAULT_MATERIALS, DEFAULT_SETTINGS } from './constants';
import {
  customExtraBoardCuts,
  customExtrasForCutList,
  defaultCustomExtraPart,
  usesCustomExtrasForm,
} from './customExtrasRules';

function kitchenUnit(customExtras: CustomExtraPart[] = []): Unit {
  return {
    type: 'kitchen_base',
    extrasEnabled: true,
    customExtras,
    width: 600,
    height: 720,
    depth: 560,
    carcass: { leftMaterialId: 'mat-white', fillerWidth: 80 },
  } as Unit;
}

const job = {
  materials: DEFAULT_MATERIALS,
  edgingMaterials: DEFAULT_EDGING,
  settings: DEFAULT_SETTINGS,
} as Job;

describe('customExtrasRules', () => {
  it('kitchen and wall use custom extras form; bedroom does not', () => {
    expect(usesCustomExtrasForm({ type: 'kitchen_base' } as Unit)).toBe(true);
    expect(usesCustomExtrasForm({ type: 'wall' } as Unit)).toBe(true);
    expect(usesCustomExtrasForm({ type: 'bedroom' } as Unit)).toBe(false);
  });

  it('lists parts only when extras enabled on kitchen', () => {
    const part = defaultCustomExtraPart(kitchenUnit(), job, 'filler');
    expect(customExtrasForCutList(kitchenUnit([part]))).toHaveLength(1);
    expect(customExtrasForCutList({ ...kitchenUnit([part]), extrasEnabled: false } as Unit)).toHaveLength(0);
    expect(customExtrasForCutList({ type: 'bedroom', extrasEnabled: true, customExtras: [part] } as Unit)).toHaveLength(
      0,
    );
  });

  it('builds cut rows with edging', () => {
    const part: CustomExtraPart = {
      ...defaultCustomExtraPart(kitchenUnit(), job, 'door'),
      length: 716,
      width: 397,
      qty: 2,
      edgingPattern: '2_long_2_short',
    };
    const [cut] = customExtraBoardCuts([part]);
    expect(cut).toMatchObject({
      partName: 'Extra · Door',
      length: 716,
      width: 397,
      qty: 2,
      edgingPattern: '2_long_2_short',
      grainHint: 'vertical',
    });
  });
});