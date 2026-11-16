import { describe, expect, it } from 'vitest';
import type { EdgingMaterial, Job, Material } from '../types';
import {
  applyBoardAdditionsToJobs,
  applyEdgingAdditionsToJobs,
  mergeEdgingAddOnly,
  mergeMaterialsAddOnly,
} from './materialCatalog';

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