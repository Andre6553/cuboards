import { DEFAULT_EDGING, DEFAULT_MATERIALS } from './constants';
import {
  extractSupplierNamesFromMaterials,
  mergeSupplierNameLists,
  pruneIncrementalSupplierNames,
} from './materialSupplierPrices';
import { collectOrderSupplierNamesFromJobMaterials } from './orderSupplier';
import type { EdgingMaterial, Job, Material } from '../types';
import { requireUserDataScope, userStorageKeys } from './userDataScope';

export interface BoardCatalog {
  materials: Material[];
  edgingMaterials: EdgingMaterial[];
  savedAt: string;
  /** Remembered supplier names for dropdowns (syncs with board catalog). */
  supplierNames?: string[];
}

function sanitizeCatalogSupplierNames(catalog: BoardCatalog): BoardCatalog {
  const supplierNames = mergeSupplierNameLists(
    pruneIncrementalSupplierNames(catalog.supplierNames ?? []),
    extractSupplierNamesFromMaterials(catalog.materials),
    collectOrderSupplierNamesFromJobMaterials(catalog.materials),
  );
  if (
    supplierNames.length === (catalog.supplierNames?.length ?? 0) &&
    JSON.stringify(supplierNames) === JSON.stringify(catalog.supplierNames ?? [])
  ) {
    return catalog;
  }
  return { ...catalog, supplierNames };
}

export function loadMaterialCatalog(): BoardCatalog | null {
  try {
    requireUserDataScope();
    const raw = localStorage.getItem(userStorageKeys.boardCatalog());
    if (!raw) return null;
    const catalog = JSON.parse(raw) as BoardCatalog;
    const sanitized = sanitizeCatalogSupplierNames(catalog);
    if (sanitized !== catalog) {
      localStorage.setItem(userStorageKeys.boardCatalog(), JSON.stringify(sanitized));
    }
    return sanitized;
  } catch {
    return null;
  }
}

export function saveMaterialCatalog(materials: Material[], edgingMaterials: EdgingMaterial[]): BoardCatalog {
  const previous = loadMaterialCatalog();
  const supplierNames = mergeSupplierNameLists(
    pruneIncrementalSupplierNames(previous?.supplierNames ?? []),
    extractSupplierNamesFromMaterials(materials),
    collectOrderSupplierNamesFromJobMaterials(materials),
  );
  const catalog: BoardCatalog = {
    materials: materials.map((m) => ({ ...m })),
    edgingMaterials: edgingMaterials.map((e) => ({ ...e })),
    supplierNames,
    savedAt: new Date().toISOString(),
  };
  requireUserDataScope();
  localStorage.setItem(userStorageKeys.boardCatalog(), JSON.stringify(catalog));
  return catalog;
}

/** Keep primary list and order; append secondary rows whose id is not already on primary. */
export function mergeMaterialsAddOnly(primary: Material[], addition: Material[]): Material[] {
  return mergeMaterialLists(primary, addition);
}

/** Keep primary edging list; append new ids from addition only. */
export function mergeEdgingAddOnly(primary: EdgingMaterial[], addition: EdgingMaterial[]): EdgingMaterial[] {
  return mergeEdgingLists(primary, addition);
}

/**
 * Update matching ids from `updates`, keep base order + extras not in updates.
 * Never removes rows that only exist on `base`.
 */
export function upsertMaterialsById(base: Material[], updates: Material[]): Material[] {
  const byId = new Map<string, Material>();
  for (const m of base) byId.set(m.id, { ...m });
  for (const m of updates) byId.set(m.id, { ...m });
  const baseIds = new Set(base.map((m) => m.id));
  return [
    ...base.map((m) => byId.get(m.id)!),
    ...updates.filter((m) => !baseIds.has(m.id)).map((m) => ({ ...m })),
  ];
}

/** Same as upsertMaterialsById for edging. */
export function upsertEdgingById(base: EdgingMaterial[], updates: EdgingMaterial[]): EdgingMaterial[] {
  const byId = new Map<string, EdgingMaterial>();
  for (const e of base) byId.set(e.id, { ...e });
  for (const e of updates) byId.set(e.id, { ...e });
  const baseIds = new Set(base.map((e) => e.id));
  return [
    ...base.map((e) => byId.get(e.id)!),
    ...updates.filter((e) => !baseIds.has(e.id)).map((e) => ({ ...e })),
  ];
}

function mergeMaterialLists(primary: Material[], secondary: Material[]): Material[] {
  const byId = new Map<string, Material>();
  for (const m of primary) byId.set(m.id, { ...m });
  for (const m of secondary) {
    if (!byId.has(m.id)) byId.set(m.id, { ...m });
  }
  const primaryIds = new Set(primary.map((m) => m.id));
  return [...primary.map((m) => byId.get(m.id)!), ...secondary.filter((m) => !primaryIds.has(m.id)).map((m) => ({ ...m }))];
}

function mergeEdgingLists(primary: EdgingMaterial[], secondary: EdgingMaterial[]): EdgingMaterial[] {
  const byId = new Map<string, EdgingMaterial>();
  for (const e of primary) byId.set(e.id, { ...e });
  for (const e of secondary) {
    if (!byId.has(e.id)) byId.set(e.id, { ...e });
  }
  const primaryIds = new Set(primary.map((e) => e.id));
  return [
    ...primary.map((e) => byId.get(e.id)!),
    ...secondary.filter((e) => !primaryIds.has(e.id)).map((e) => ({ ...e })),
  ];
}

/** Union of catalog + every job’s boards/edging (add-only by id; first occurrence wins). */
export function unionMaterialsFromJobs(jobs: Job[], catalog?: BoardCatalog | null): {
  materials: Material[];
  edgingMaterials: EdgingMaterial[];
} {
  const cat = catalog ?? loadMaterialCatalog();
  let materials = (cat?.materials ?? []).map((m) => ({ ...m }));
  let edgingMaterials = (cat?.edgingMaterials ?? []).map((e) => ({ ...e }));
  for (const job of jobs) {
    if (job.materials?.length) materials = mergeMaterialLists(materials, job.materials);
    if (job.edgingMaterials?.length) edgingMaterials = mergeEdgingLists(edgingMaterials, job.edgingMaterials);
  }
  return { materials, edgingMaterials };
}

/**
 * Write job boards into the account catalog: update matching ids from the job,
 * keep catalog (and union) rows the job does not have. Never deletes board types.
 */
export function upsertMaterialCatalogFromJob(
  jobMaterials: Material[],
  jobEdging: EdgingMaterial[],
  jobs: Job[] = [],
): BoardCatalog {
  const { materials: unionMats, edgingMaterials: unionEdge } = unionMaterialsFromJobs(
    jobs,
    loadMaterialCatalog(),
  );
  return saveMaterialCatalog(
    upsertMaterialsById(unionMats, jobMaterials),
    upsertEdgingById(unionEdge, jobEdging),
  );
}

/** Create or upgrade catalog from defaults, price list, or existing jobs (first run). */
export function ensureMaterialCatalog(jobs: Job[] = []): BoardCatalog {
  const existing = loadMaterialCatalog();
  if (existing?.materials?.length && existing.edgingMaterials?.length) {
    return existing;
  }

  let materials = DEFAULT_MATERIALS.map((m) => ({ ...m }));
  let edgingMaterials = DEFAULT_EDGING.map((e) => ({ ...e }));

  for (const job of jobs) {
    if (job.materials?.length) materials = mergeMaterialLists(materials, job.materials);
    if (job.edgingMaterials?.length) edgingMaterials = mergeEdgingLists(edgingMaterials, job.edgingMaterials);
  }

  return saveMaterialCatalog(materials, edgingMaterials);
}

/** Attach global board + edging lists to a job (catalog first, keep job-only legacy ids). */
export function hydrateJobFromCatalog(job: Job, catalog: BoardCatalog): Job {
  return {
    ...job,
    materials: mergeMaterialLists(catalog.materials, job.materials ?? []),
    edgingMaterials: mergeEdgingLists(catalog.edgingMaterials, job.edgingMaterials ?? []),
  };
}

export function catalogFingerprint(materials: Material[], edgingMaterials: EdgingMaterial[]): string {
  return JSON.stringify({ materials, edgingMaterials });
}

/** Board/edging identity for jobs — excludes per-supplier price rows so typing supplier names does not rewrite every job. */
export function catalogJobSyncFingerprint(materials: Material[], edgingMaterials: EdgingMaterial[]): string {
  const materialsSlim = materials.map(
    ({ supplierPrices: _supplierPrices, ...rest }) => rest,
  );
  return JSON.stringify({ materials: materialsSlim, edgingMaterials });
}

/** Merge imported / price-list boards into the global catalog. */
export function mergeIntoMaterialCatalog(materials: Material[], edgingMaterials: EdgingMaterial[]): BoardCatalog {
  const current = ensureMaterialCatalog([]);
  return saveMaterialCatalog(
    mergeMaterialLists(current.materials, materials),
    mergeEdgingLists(current.edgingMaterials, edgingMaterials),
  );
}

export function applyCatalogToAllJobs(jobs: Job[], catalog: BoardCatalog): Job[] {
  const materials = catalog.materials.map((m) => ({ ...m }));
  const edgingMaterials = catalog.edgingMaterials.map((e) => ({ ...e }));
  return jobs.map((j) => ({
    ...j,
    materials: mergeMaterialsAddOnly(j.materials ?? [], materials),
    edgingMaterials: mergeEdgingAddOnly(j.edgingMaterials ?? [], edgingMaterials),
  }));
}

/** Merge source boards/edging into each job without removing that job's existing types. */
export function applyBoardAdditionsToJobs(
  jobs: Job[],
  additionMaterials: Material[],
  additionEdging: EdgingMaterial[],
): { jobs: Job[]; updatedCount: number } {
  const sourceMaterials = additionMaterials.map((m) => ({ ...m }));
  const sourceEdging = additionEdging.map((e) => ({ ...e }));
  const now = new Date().toISOString();
  let updatedCount = 0;
  const next = jobs.map((j) => {
    const materials = mergeMaterialsAddOnly(j.materials ?? [], sourceMaterials);
    const edgingMaterials = mergeEdgingAddOnly(j.edgingMaterials ?? [], sourceEdging);
    if (
      catalogFingerprint(j.materials, j.edgingMaterials) ===
      catalogFingerprint(materials, edgingMaterials)
    ) {
      return j;
    }
    updatedCount += 1;
    return { ...j, materials, edgingMaterials, updatedAt: now };
  });
  return { jobs: next, updatedCount };
}

/** Add this job's board/edging types to the shared catalog and to every other job (never removes types). */
export function pushBoardCatalogToAllJobs(
  jobs: Job[],
  materials: Material[],
  edgingMaterials: EdgingMaterial[],
): { jobs: Job[]; updatedCount: number } {
  mergeIntoMaterialCatalog(materials, edgingMaterials);
  return applyBoardAdditionsToJobs(jobs, materials, edgingMaterials);
}

/** Merge edging into the device catalog without changing board rows. */
export function mergeEdgingIntoCatalog(edgingMaterials: EdgingMaterial[]): void {
  const current = loadMaterialCatalog() ?? ensureMaterialCatalog([]);
  saveMaterialCatalog(current.materials, mergeEdgingLists(current.edgingMaterials, edgingMaterials));
}

/** Add edging types from this job onto every job; existing edging on each job is kept. */
export function applyEdgingAdditionsToJobs(
  jobs: Job[],
  additionEdging: EdgingMaterial[],
): { jobs: Job[]; updatedCount: number } {
  const sourceEdging = additionEdging.map((e) => ({ ...e }));
  const now = new Date().toISOString();
  let updatedCount = 0;
  const next = jobs.map((j) => {
    const edgingMaterials = mergeEdgingAddOnly(j.edgingMaterials ?? [], sourceEdging);
    const before = catalogFingerprint(j.materials ?? [], j.edgingMaterials ?? []);
    const after = catalogFingerprint(j.materials ?? [], edgingMaterials);
    if (before === after) return j;
    updatedCount += 1;
    return { ...j, edgingMaterials, updatedAt: now };
  });
  return { jobs: next, updatedCount };
}

export function pushEdgingToAllJobs(
  jobs: Job[],
  edgingMaterials: EdgingMaterial[],
): { jobs: Job[]; updatedCount: number } {
  mergeEdgingIntoCatalog(edgingMaterials);
  return applyEdgingAdditionsToJobs(jobs, edgingMaterials);
}
