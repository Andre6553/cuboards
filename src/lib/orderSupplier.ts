import { normalizeSupplierName } from './materialSupplierPrices';
import type { CutPiece, Job, SheetMapGroup } from '../types';

export const MASONITE_MATERIAL_ID = 'masonite';

/** Who should cut / supply this material (cut house). */
export function resolveOrderSupplierForMaterialId(job: Job, materialId: string): string {
  if (materialId === MASONITE_MATERIAL_ID) {
    return normalizeSupplierName(
      job.masonite.orderFromSupplier ?? job.settings.defaultOrderSupplier ?? '',
    );
  }
  const mat = job.materials.find((m) => m.id === materialId);
  return normalizeSupplierName(mat?.orderFromSupplier ?? job.settings.defaultOrderSupplier ?? '');
}

export function pieceMatchesOrderSupplierFilter(
  job: Job,
  piece: CutPiece,
  supplierFilter: string,
): boolean {
  const want = normalizeSupplierName(supplierFilter);
  if (!want) return true;
  const assigned = resolveOrderSupplierForMaterialId(job, piece.materialId);
  return assigned.toLowerCase() === want.toLowerCase();
}

export function filterPiecesForOrderSupplier(
  job: Job,
  pieces: CutPiece[],
  supplierFilter: string | null | undefined,
): CutPiece[] {
  if (!supplierFilter?.trim()) return pieces;
  return pieces.filter((p) => pieceMatchesOrderSupplierFilter(job, p, supplierFilter));
}

export function filterSheetMapGroupsForOrderSupplier(
  job: Job,
  groups: SheetMapGroup[],
  supplierFilter: string | null | undefined,
): SheetMapGroup[] {
  if (!supplierFilter?.trim()) return groups;
  const want = normalizeSupplierName(supplierFilter).toLowerCase();
  return groups.filter((g) => {
    const assigned = resolveOrderSupplierForMaterialId(job, g.materialId);
    return assigned.toLowerCase() === want;
  });
}

/** Suppliers that have at least one cut-list part assigned on this job. */
export function listOrderSuppliersOnJob(job: Job, pieces: CutPiece[]): string[] {
  const seen = new Map<string, string>();
  for (const p of pieces) {
    if (p.qty <= 0) continue;
    const name = resolveOrderSupplierForMaterialId(job, p.materialId);
    if (!name) continue;
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function countUnassignedOrderSupplierPieces(job: Job, pieces: CutPiece[]): number {
  let n = 0;
  for (const p of pieces) {
    if (p.qty <= 0) continue;
    if (!resolveOrderSupplierForMaterialId(job, p.materialId)) n += 1;
  }
  return n;
}

export function collectOrderSupplierNamesFromJobMaterials(materials: Job['materials']): string[] {
  const names: string[] = [];
  for (const m of materials) {
    const n = normalizeSupplierName(m.orderFromSupplier ?? '');
    if (n) names.push(n);
  }
  return names;
}

export function slugifySupplierForFilename(name: string): string {
  return (
    normalizeSupplierName(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'supplier'
  );
}
