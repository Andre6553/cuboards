import { isCompleteSupplierName, normalizeSupplierName } from './materialSupplierPrices';
import type { CutPiece, Job, SheetMapGroup } from '../types';

export const MASONITE_MATERIAL_ID = 'masonite';

/** Most common cut house on board rows (tie → none). Used when masonite has no Order from. */
function dominantBoardOrderSupplier(materials: Job['materials']): string {
  const counts = new Map<string, { n: number; label: string }>();
  for (const m of materials) {
    const name = normalizeSupplierName(m.orderFromSupplier ?? '');
    if (!name || !isCompleteSupplierName(name)) continue;
    const key = name.toLowerCase();
    const cur = counts.get(key);
    if (cur) cur.n += 1;
    else counts.set(key, { n: 1, label: name });
  }
  let best: { n: number; label: string } | null = null;
  let tied = false;
  for (const v of counts.values()) {
    if (!best || v.n > best.n) {
      best = v;
      tied = false;
    } else if (best && v.n === best.n) {
      tied = true;
    }
  }
  if (!best || tied) return '';
  return best.label;
}

function jobDefaultOrderSupplier(job: Job): string {
  return normalizeSupplierName(job.settings.defaultOrderSupplier ?? '');
}

function resolveMasoniteOrderSupplier(job: Job): string {
  const explicit = normalizeSupplierName(job.masonite.orderFromSupplier ?? '');
  if (explicit) return explicit;
  const fromJobDefault = jobDefaultOrderSupplier(job);
  if (fromJobDefault) return fromJobDefault;
  return dominantBoardOrderSupplier(job.materials);
}

/** Who should cut / supply this material (cut house). */
export function resolveOrderSupplierForMaterialId(job: Job, materialId: string): string {
  if (materialId === MASONITE_MATERIAL_ID) {
    return resolveMasoniteOrderSupplier(job);
  }
  const mat = job.materials.find((m) => m.id === materialId);
  return normalizeSupplierName(mat?.orderFromSupplier ?? jobDefaultOrderSupplier(job));
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
  return summarizeUnassignedOrderSupplierPieces(job, pieces).total;
}

export function summarizeUnassignedOrderSupplierPieces(
  job: Job,
  pieces: CutPiece[],
): { total: number; masoniteLines: number; otherLines: number } {
  let total = 0;
  let masoniteLines = 0;
  let otherLines = 0;
  for (const p of pieces) {
    if (p.qty <= 0) continue;
    if (resolveOrderSupplierForMaterialId(job, p.materialId)) continue;
    total += 1;
    if (p.materialId === MASONITE_MATERIAL_ID) masoniteLines += 1;
    else otherLines += 1;
  }
  return { total, masoniteLines, otherLines };
}

export function collectOrderSupplierNamesFromJobMaterials(materials: Job['materials']): string[] {
  const names: string[] = [];
  for (const m of materials) {
    const n = normalizeSupplierName(m.orderFromSupplier ?? '');
    if (n && isCompleteSupplierName(n)) names.push(n);
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
