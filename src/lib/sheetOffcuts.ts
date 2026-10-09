import type { BoardOffcut, CutPiece, Job } from '../types';
import { cutPiecesToLayout } from './sheetLayoutPieces';
import { layoutSheets, resolveSawKerfMm } from './sheetLayout';
import { masonitePurchaseFraction, sheetPurchaseFraction } from './sheetCost';

const MASONITE_ID = 'masonite';

/** Nest panels on job sheet sizes and list usable offcuts (geometry only — not board wastage %). */
export function calcBoardOffcuts(job: Job, pieces: CutPiece[]): BoardOffcut[] {
  const { sheetWidth, sheetHeight } = job.settings;
  const sawKerfMm = resolveSawKerfMm(job.settings);
  const byMaterial = new Map<string, CutPiece[]>();

  for (const piece of pieces) {
    if (piece.materialId === MASONITE_ID) continue;
    const list = byMaterial.get(piece.materialId) ?? [];
    list.push(piece);
    byMaterial.set(piece.materialId, list);
  }

  const offcuts: BoardOffcut[] = [];

  for (const m of job.materials) {
    const matPieces = byMaterial.get(m.id);
    if (!matPieces?.length) continue;
    const purchaseFrac = sheetPurchaseFraction(m);
    const layout = layoutSheets(
      cutPiecesToLayout(matPieces),
      sheetWidth,
      sheetHeight,
      sawKerfMm,
      purchaseFrac,
    );
    for (const o of layout.offcuts) {
      offcuts.push({
        materialId: m.id,
        materialName: m.name,
        sheetIndex: o.sheetIndex,
        widthMm: o.widthMm,
        lengthMm: o.lengthMm,
        areaMm2: o.areaMm2,
      });
    }
  }

  const masonitePieces = pieces.filter((p) => p.materialId === MASONITE_ID);
  if (masonitePieces.length > 0) {
    const purchaseFrac = masonitePurchaseFraction(job.masonite);
    const layout = layoutSheets(
      cutPiecesToLayout(masonitePieces),
      job.masonite.sheetWidth ?? 2440,
      job.masonite.sheetHeight ?? 1220,
      sawKerfMm,
      purchaseFrac,
    );
    const label = `${job.masonite.name} (${job.masonite.colour})`;
    for (const o of layout.offcuts) {
      offcuts.push({
        materialId: MASONITE_ID,
        materialName: label,
        sheetIndex: o.sheetIndex,
        widthMm: o.widthMm,
        lengthMm: o.lengthMm,
        areaMm2: o.areaMm2,
      });
    }
  }

  return offcuts.sort(
    (a, b) =>
      a.materialName.localeCompare(b.materialName) ||
      a.sheetIndex - b.sheetIndex ||
      b.areaMm2 - a.areaMm2,
  );
}
