import { describe, expect, it } from 'vitest';
import { createDefaultUnit } from './calculator';
import { DEFAULT_SETTINGS } from './constants';
import {
  omitJobMaterialDefaultsFromSettings,
  resolveJobMaterialDefaults,
} from './jobMaterialDefaults';
import type { EdgingMaterial, Job, JobSettings, Material } from '../types';

const materials: Material[] = [
  {
    id: 'mat-white',
    name: 'White Melamine',
    colour: 'White',
    pricePerSheet: 500,
    hasGrain: false,
    edgingMaterialId: 'edge-white',
  },
  {
    id: 'mat-oak',
    name: 'Oak Melamine',
    colour: 'Oak',
    pricePerSheet: 800,
    hasGrain: true,
    edgingMaterialId: 'edge-oak',
  },
];

const edging: EdgingMaterial[] = [
  { id: 'edge-white', name: 'White PVC', thickness: 1, pricePerMetre: 8 },
  { id: 'edge-oak', name: 'Oak PVC', thickness: 1, pricePerMetre: 15 },
  { id: 'edge-abs', name: 'ABS 2mm', thickness: 2, pricePerMetre: 20 },
];

function job(settings: Partial<JobSettings> = {}) {
  return {
    materials,
    edgingMaterials: edging,
    settings: { ...DEFAULT_SETTINGS, ...settings },
  };
}

describe('resolveJobMaterialDefaults', () => {
  it('falls back to materials[0]/[1] and linked edging when unset', () => {
    const d = resolveJobMaterialDefaults(job());
    expect(d.carcassMaterialId).toBe('mat-white');
    expect(d.visibleSideMaterialId).toBe('mat-oak');
    expect(d.carcassEdgingMaterialId).toBe('edge-white');
    expect(d.doorMaterialId).toBe('mat-oak');
    expect(d.doorEdgingMaterialId).toBe('edge-oak');
    expect(d.drawerFrontMaterialId).toBe('mat-oak');
    expect(d.drawerBoxMaterialId).toBe('mat-white');
    expect(d.drawerBoxEdgingMaterialId).toBe('edge-white');
  });

  it('uses job settings when IDs exist on the job', () => {
    const d = resolveJobMaterialDefaults(
      job({
        defaultVisibleSideMaterialId: 'mat-oak',
        defaultCarcassMaterialId: 'mat-white',
        defaultCarcassEdgingMaterialId: 'edge-abs',
        defaultDoorMaterialId: 'mat-oak',
        defaultDoorEdgingMaterialId: 'edge-oak',
        defaultDrawerFrontMaterialId: 'mat-white',
        defaultDrawerFrontEdgingMaterialId: 'edge-white',
      }),
    );
    expect(d.visibleSideMaterialId).toBe('mat-oak');
    expect(d.carcassMaterialId).toBe('mat-white');
    expect(d.carcassEdgingMaterialId).toBe('edge-abs');
    expect(d.doorMaterialId).toBe('mat-oak');
    expect(d.doorEdgingMaterialId).toBe('edge-oak');
    expect(d.drawerFrontMaterialId).toBe('mat-white');
    expect(d.drawerFrontEdgingMaterialId).toBe('edge-white');
    expect(d.drawerBoxMaterialId).toBe('mat-white');
    expect(d.drawerBoxEdgingMaterialId).toBe('edge-abs');
  });

  it('ignores unknown IDs', () => {
    const d = resolveJobMaterialDefaults(
      job({
        defaultCarcassMaterialId: 'missing',
        defaultCarcassEdgingMaterialId: 'missing-edge',
      }),
    );
    expect(d.carcassMaterialId).toBe('mat-white');
    expect(d.carcassEdgingMaterialId).toBe('edge-white');
  });
});

describe('omitJobMaterialDefaultsFromSettings', () => {
  it('strips only the per-job material default fields', () => {
    const next = omitJobMaterialDefaultsFromSettings({
      ...DEFAULT_SETTINGS,
      defaultCarcassMaterialId: 'mat-white',
      defaultDoorMaterialId: 'mat-oak',
      defaultGap: 3,
    });
    expect(next.defaultCarcassMaterialId).toBeUndefined();
    expect(next.defaultDoorMaterialId).toBeUndefined();
    expect(next.defaultGap).toBe(3);
    expect(next.thickness).toBe(DEFAULT_SETTINGS.thickness);
  });
});

describe('createDefaultUnit with job material defaults', () => {
  it('applies carcass and visible side from job settings', () => {
    const fullJob = {
      id: 'job-1',
      materials,
      edgingMaterials: edging,
      settings: {
        ...DEFAULT_SETTINGS,
        defaultVisibleSideMaterialId: 'mat-oak',
        defaultCarcassMaterialId: 'mat-white',
        defaultCarcassEdgingMaterialId: 'edge-abs',
      },
      units: [],
    } as unknown as Job;
    const unit = createDefaultUnit(fullJob, 0);
    expect(unit.carcass.leftMaterialId).toBe('mat-oak');
    expect(unit.carcass.rightMaterialId).toBe('mat-white');
    expect(unit.carcass.bottomMaterialId).toBe('mat-white');
    expect(unit.carcass.leftEdgingMaterialId).toBe('edge-abs');
    expect(unit.carcass.bottomEdgingMaterialId).toBe('edge-abs');
    expect(unit.plinth?.kickplateMaterialId).toBe('mat-oak');
  });
});
