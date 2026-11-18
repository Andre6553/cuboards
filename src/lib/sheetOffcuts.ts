import type { BoardOffcut, CutPiece, Job } from '../types';
import { resolveMasoniteSheetForJob } from './masoniteSheetRules';
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
      cutPiecesToLayout(matPieces, { materialHasGrain: m.hasGrain }),
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
    const picked = resolveMasoniteSheetForJob(job.masonite, masonitePieces, job.units);
    const purchaseFrac = masonitePurchaseFraction(job.masonite, picked.label);
    const layout = layoutSheets(
      cutPiecesToLayout(masonitePieces),
      picked.width,
      picked.height,
      sawKerfMm,
      purchaseFrac,
    );
    const sizeTag = picked.label === 'large' ? 'large' : 'small';
    const label = `${job.masonite.name} (${picked.colour}) · ${sizeTag} ${picked.width}×${picked.height}`;
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
