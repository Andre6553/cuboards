import { grainLabel } from './sheetLayout';
import { formatCutListDimensions } from './edgingCutSize';
import type { CutPiece, EdgingPattern, Job } from '../types';

export interface FactoryEdgingTicks {
  l1: boolean;
  l2: boolean;
  b1: boolean;
  b2: boolean;
}

/** Map Cuboards edging pattern to factory L1/L2/B1/B2 tick boxes (length = long sides, B = short ends). */
export function edgingPatternToFactoryTicks(pattern: EdgingPattern): FactoryEdgingTicks {
  switch (pattern) {
    case '1_long':
      return { l1: true, l2: false, b1: false, b2: false };
    case '2_long':
      return { l1: true, l2: true, b1: false, b2: false };
    case '1_long_1_short':
      return { l1: true, l2: false, b1: true, b2: false };
    case '1_long_2_short':
      return { l1: true, l2: false, b1: true, b2: true };
    case '2_long_2_short':
      return { l1: true, l2: true, b1: true, b2: true };
    default:
      return { l1: false, l2: false, b1: false, b2: false };
  }
}

export interface FactoryCutListRow {
  unitId: string;
  description: string;
  boardColour: string;
  finish: string;
  lengthMm: number;
  widthMm: number;
  qty: number;
  edging: FactoryEdgingTicks;
  edgingThickMm: number | null;
  edgingColour: string;
  hingeHoles: string;
  notes: string;
}

function parseDimensionPair(formatted: string): { lengthMm: number; widthMm: number } {
  const parts = formatted.split('×').map((s) => s.trim());
  if (parts.length !== 2) return { lengthMm: 0, widthMm: 0 };
  return { lengthMm: Number(parts[0]), widthMm: Number(parts[1]) };
}

function factoryFinish(piece: CutPiece, job: Job): string {
  const mat = job.materials.find((m) => m.id === piece.materialId);
  if (piece.grain !== 'none') {
    return mat?.hasGrain ? 'Linear' : grainLabel(piece.grain);
  }
  return '—';
}

export function pieceToFactoryRow(job: Job, piece: CutPiece): FactoryCutListRow {
  const mat = job.materials.find((m) => m.id === piece.materialId);
  const edgingMat = job.edgingMaterials.find((e) => e.id === piece.edgingMaterialId);
  const pattern = piece.edgingPattern ?? 'none';
  const ticks = edgingPatternToFactoryTicks(pattern);
  const dim = formatCutListDimensions(piece.width, piece.length, piece.longAlong ?? 'length');
  const { lengthMm, widthMm } = parseDimensionPair(dim);

  let hingeHoles = '—';
  if (piece.category === 'door') {
    hingeHoles = piece.factoryHingeHoles !== false ? 'Yes' : 'No';
  }

  return {
    unitId: piece.unitName,
    description: piece.partName,
    boardColour: mat?.colour?.trim() || mat?.name || '—',
    finish: factoryFinish(piece, job),
    lengthMm,
    widthMm,
    qty: piece.qty,
    edging: ticks,
    edgingThickMm: pattern === 'none' ? null : (edgingMat?.thickness ?? null),
    edgingColour: pattern === 'none' ? '—' : (edgingMat?.name?.trim() || '—'),
    hingeHoles,
    notes: piece.notes?.replace(/\s*·\s*/g, '; ') ?? '',
  };
}

export function buildFactoryCutListRows(job: Job, pieces: CutPiece[]): FactoryCutListRow[] {
  return pieces
    .filter((p) => p.qty > 0)
    .map((p) => pieceToFactoryRow(job, p))
    .sort(
      (a, b) =>
        a.unitId.localeCompare(b.unitId) ||
        a.description.localeCompare(b.description) ||
        b.lengthMm - a.lengthMm ||
        b.widthMm - a.widthMm,
    );
}

export function factoryTickCell(on: boolean): string {
  return on ? '✓' : '';
}
