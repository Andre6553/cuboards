import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EdgingMaterial, Job, Material } from '../types';
import {
  applyBoardAdditionsToJobs,
  applyEdgingAdditionsToJobs,
  loadMaterialCatalog,
  mergeEdgingAddOnly,
  mergeMaterialsAddOnly,
  unionMaterialsFromJobs,
  upsertMaterialCatalogFromJob,
  upsertMaterialsById,
} from './materialCatalog';
import { setUserDataScope } from './userDataScope';

const board = (id: string, name: string): Material => ({
  id,
  name,
  colour: name,
  pricePerSheet: 100,
  hasGrain: false,
  buyAs: 'full',
  edgingMaterialId: 'edge-1',
});

const edge = (id: string, name: string): EdgingMaterial => ({
  id,
  name,
  thickness: 1,
  pricePerMeter: 10,
});

function stubJob(id: string, materials: Material[], edgingMaterials: EdgingMaterial[]): Job {
  return { id, updatedAt: '2026-01-01', materials, edgingMaterials } as Job;
}

beforeEach(() => {
  setUserDataScope('vitest-catalog');
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  });
});

describe('upsertMaterialsById', () => {
  it('updates matching ids and keeps extras from base', () => {
    const base = [board('a', 'A'), board('b', 'Keep me')];
    const updates = [board('a', 'A new price')];
    updates[0].pricePerSheet = 999;
    const out = upsertMaterialsById(base, updates);
    expect(out.map((m) => m.id)).toEqual(['a', 'b']);
    expect(out.find((m) => m.id === 'a')?.pricePerSheet).toBe(999);
    expect(out.find((m) => m.id === 'b')?.name).toBe('Keep me');
  });
});

describe('upsertMaterialCatalogFromJob', () => {
  it('never drops boards that only exist on other jobs', () => {
    const thin = stubJob('thin', [board('shared', 'Shared')], [edge('e1', 'E1')]);
    thin.materials[0].pricePerSheet = 500;
    const rich = stubJob(
      'rich',
      [board('shared', 'Shared'), board('only-rich', 'Only rich')],
      [edge('e1', 'E1'), edge('e2', 'Extra edge')],
    );
    const catalog = upsertMaterialCatalogFromJob(thin.materials, thin.edgingMaterials, [thin, rich]);
    expect(catalog.materials.map((m) => m.id).sort()).toEqual(['only-rich', 'shared'].sort());
    expect(catalog.materials.find((m) => m.id === 'shared')?.pricePerSheet).toBe(500);
    expect(catalog.edgingMaterials.map((e) => e.id).sort()).toEqual(['e1', 'e2'].sort());
    expect(loadMaterialCatalog()?.materials.map((m) => m.id).sort()).toEqual(['only-rich', 'shared'].sort());
  });
});

describe('unionMaterialsFromJobs', () => {
  it('unions catalog and all jobs without dropping types', () => {
    upsertMaterialCatalogFromJob([board('cat-only', 'Cat')], [edge('e-cat', 'Cat edge')], []);
    const a = stubJob('a', [board('a-only', 'A')], [edge('e-a', 'A')]);
    const b = stubJob('b', [board('b-only', 'B')], [edge('e-b', 'B')]);
    const { materials, edgingMaterials } = unionMaterialsFromJobs([a, b]);
    expect(materials.map((m) => m.id).sort()).toEqual(['a-only', 'b-only', 'cat-only'].sort());
    expect(edgingMaterials.map((e) => e.id).sort()).toEqual(['e-a', 'e-b', 'e-cat'].sort());
  });
});

describe('mergeMaterialsAddOnly', () => {
  it('keeps job boards and only appends new ids from source', () => {
    const job = [board('a', 'A'), board('b', 'Job only')];
    const source = [board('a', 'A updated'), board('c', 'New')];
    const merged = mergeMaterialsAddOnly(job, source);
    expect(merged.map((m) => m.id)).toEqual(['a', 'b', 'c']);
    expect(merged.find((m) => m.id === 'a')?.name).toBe('A');
    expect(merged.find((m) => m.id === 'b')?.name).toBe('Job only');
    expect(merged.find((m) => m.id === 'c')?.name).toBe('New');
  });
});

describe('mergeEdgingAddOnly', () => {
  it('keeps job edging types when source is smaller', () => {
    const job = [edge('e1', 'White'), edge('e2', 'Extra on job')];
    const source = [edge('e1', 'White PVC')];
    const merged = mergeEdgingAddOnly(job, source);
    expect(merged.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(merged.find((e) => e.id === 'e2')?.name).toBe('Extra on job');
  });
});

describe('applyBoardAdditionsToJobs', () => {
  it('does not remove boards or edging from other jobs', () => {
    const source = stubJob('source', [board('shared', 'Shared'), board('only-source', 'Only S')], [edge('e1', 'E1')]);
    const target = stubJob(
      'target',
      [board('shared', 'Shared'), board('only-target', 'Only T')],
      [edge('e1', 'E1'), edge('e2', 'Target edge')],
    );
    const { jobs, updatedCount } = applyBoardAdditionsToJobs([source, target], source.materials, source.edgingMaterials);
    expect(updatedCount).toBe(1);
    const out = jobs.find((j) => j.id === 'target')!;
    expect(out.materials.map((m) => m.id).sort()).toEqual(['only-source', 'only-target', 'shared'].sort());
    expect(out.edgingMaterials.map((e) => e.id).sort()).toEqual(['e1', 'e2'].sort());
  });
});

describe('applyEdgingAdditionsToJobs', () => {
  it('adds edging without removing or changing boards', () => {
    const source = stubJob('source', [board('b1', 'B')], [edge('e1', 'E1'), edge('e-new', 'New edge')]);
    const target = stubJob(
      'target',
      [board('b1', 'B'), board('only-target', 'T')],
      [edge('e1', 'E1'), edge('e-target', 'Target only')],
    );
    const { jobs, updatedCount } = applyEdgingAdditionsToJobs([source, target], source.edgingMaterials);
    expect(updatedCount).toBe(1);
    const out = jobs.find((j) => j.id === 'target')!;
    expect(out.materials.map((m) => m.id).sort()).toEqual(['b1', 'only-target'].sort());
    expect(out.edgingMaterials.map((e) => e.id).sort()).toEqual(['e-new', 'e-target', 'e1'].sort());
  });
});