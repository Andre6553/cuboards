import type { CutPiece, Job, SheetMapGroup, SheetMapSheet } from '../types';
import { masonitePurchaseFraction, sheetPurchaseFraction } from './sheetCost';
import { cutPiecesToLayout } from './sheetLayoutPieces';
import { layoutSheets, resolveSawKerfMm } from './sheetLayout';

const MASONITE_ID = 'masonite';

function layoutToSheets(
  pieces: CutPiece[],
  sheetWidth: number,
  sheetHeight: number,
  purchaseFraction: number,
  sawKerfMm: number,
): SheetMapSheet[] {
  const layout = layoutSheets(
    cutPiecesToLayout(pieces),
    sheetWidth,
    sheetHeight,
    sawKerfMm,
    purchaseFraction,
  );
  return layout.sheetDetails.map((sd) => ({
    sheetIndex: sd.sheetIndex,
    grainLengthMm: sd.grainLengthMm,
    crossLengthMm: sd.crossLengthMm,
    placements: sd.placements.map((p) => ({
      xMm: p.x,
      yMm: p.y,
      widthMm: p.widthMm,
      heightMm: p.heightMm,
      label: p.label,
      grainLocked: p.grainLocked,
    })),
    offcutRects: sd.offcutRects.map((r) => ({
      xMm: r.x,
      yMm: r.y,
      widthMm: r.widthMm,
      heightMm: r.heightMm,
    })),
  }));
}

/** Visual sheet maps per material — same nesting as offcuts / sheet count. */
export function calcSheetMaps(job: Job, pieces: CutPiece[]): SheetMapGroup[] {
  const { sheetWidth, sheetHeight } = job.settings;
  const sawKerfMm = resolveSawKerfMm(job.settings);
  const byMaterial = new Map<string, CutPiece[]>();

  for (const piece of pieces) {
    if (piece.materialId === MASONITE_ID) continue;
    const list = byMaterial.get(piece.materialId) ?? [];
    list.push(piece);
    byMaterial.set(piece.materialId, list);
  }

  const groups: SheetMapGroup[] = [];

  for (const m of job.materials) {
    const matPieces = byMaterial.get(m.id);
    if (!matPieces?.length) continue;
    const sheets = layoutToSheets(matPieces, sheetWidth, sheetHeight, sheetPurchaseFraction(m), sawKerfMm);
    if (sheets.length === 0) continue;
    groups.push({
      materialId: m.id,
      materialName: m.name,
      sheets,
    });
  }

  const masonitePieces = pieces.filter((p) => p.materialId === MASONITE_ID);
  if (masonitePieces.length > 0) {
    const sheets = layoutToSheets(
      masonitePieces,
      job.masonite.sheetWidth ?? 2440,
      job.masonite.sheetHeight ?? 1220,
      masonitePurchaseFraction(job.masonite),
      sawKerfMm,
    );
    if (sheets.length > 0) {
      groups.push({
        materialId: MASONITE_ID,
        materialName: `${job.masonite.name} (${job.masonite.colour})`,
        sheets,
      });
    }
  }

  return groups;
}
