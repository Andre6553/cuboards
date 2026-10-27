import { DEFAULT_EDGING, DEFAULT_MATERIALS } from './constants';
import { extractSupplierNamesFromMaterials, mergeSupplierNameLists } from './materialSupplierPrices';
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

export function loadMaterialCatalog(): BoardCatalog | null {
  try {
    requireUserDataScope();
    const raw = localStorage.getItem(userStorageKeys.boardCatalog());
    return raw ? (JSON.parse(raw) as BoardCatalog) : null;
  } catch {
    return null;
  }
}

export function saveMaterialCatalog(materials: Material[], edgingMaterials: EdgingMaterial[]): BoardCatalog {
  const previous = loadMaterialCatalog();
  const supplierNames = mergeSupplierNameLists(
    previous?.supplierNames,
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
  return jobs.map((j) => ({ ...j, materials, edgingMaterials }));
}
