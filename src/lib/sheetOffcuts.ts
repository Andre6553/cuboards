import type { BoardOffcut, CutPiece, Job } from '../types';
import { layoutSheets, SAW_KERF_MM } from './sheetLayout';
import { sheetPurchaseFraction } from './sheetCost';

const MASONITE_ID = 'masonite';

function piecesToLayout(pieces: CutPiece[]) {
  return pieces.map((p) => ({
    length: p.length,
    width: p.width,
    qty: p.qty,
    grainLocked: p.grain !== 'none',
    label: `${p.partName} (${p.unitName}) ${p.length} × ${p.width}`,
  }));
}

/** Nest panels on job sheet sizes and list usable offcuts (geometry only — not board wastage %). */
export function calcBoardOffcuts(job: Job, pieces: CutPiece[]): BoardOffcut[] {
  const { sheetWidth, sheetHeight } = job.settings;
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
      piecesToLayout(matPieces),
      sheetWidth,
      sheetHeight,
      SAW_KERF_MM,
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
    const purchaseFrac = 0.25;
    const layout = layoutSheets(
      piecesToLayout(masonitePieces),
      job.masonite.sheetWidth ?? 2440,
      job.masonite.sheetHeight ?? 1220,
      SAW_KERF_MM,
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
