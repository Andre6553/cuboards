import { describe, expect, it } from 'vitest';
import { edgingRunMm } from './edgingCutSize';
import { edgingMaterialIdForPattern, NO_EDGING_MATERIAL_ID } from './edgingPatternSync';

describe('edgingMaterialIdForPattern', () => {
  it('clears material when pattern is none', () => {
    expect(edgingMaterialIdForPattern('none', 'edge-white', 'edge-oak')).toBe(NO_EDGING_MATERIAL_ID);
  });

  it('keeps or falls back when pattern has edging', () => {
    expect(edgingMaterialIdForPattern('1_long', 'edge-white', 'edge-oak')).toBe('edge-white');
    expect(edgingMaterialIdForPattern('1_long', '', 'edge-oak')).toBe('edge-oak');
    expect(edgingMaterialIdForPattern('1_short', 'edge-white', 'edge-oak')).toBe('edge-white');
  });
});