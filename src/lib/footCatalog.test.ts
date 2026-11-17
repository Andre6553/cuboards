import { describe, expect, it } from 'vitest';
import { cabinetFootHardwareDetail, GELMAR_CABINET_FOOT } from './footCatalog';

describe('footCatalog', () => {
  it('includes Gelmar SKU in cut-list hardware detail', () => {
    const detail = cabinetFootHardwareDetail(4);
    expect(detail).toContain(GELMAR_CABINET_FOOT.sku);
    expect(detail).toContain('4/cupboard');
  });
});