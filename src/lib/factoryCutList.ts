import type { jsPDF } from 'jspdf';
import { grainLabel } from './sheetLayout';
import { factoryCutDimensions } from './edgingCutSize';
import {
  edgingTapeKeyFromMaterial,
  kickplateEdgingToFactoryTicks,
  pieceHasKickplateEdging,
} from './kickplateEdging';
import type { CutPiece, EdgingPattern, Job } from '../types';

export interface FactoryEdgingTicks {
  l1: boolean;
  l2: boolean;
  b1: boolean;
  b2: boolean;
}

/** L1/L2 = edges on the Length column sides; B1/B2 = Width column sides (long tape runs along Length). */
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

/** Factory section title — board + edging tape (when applicable). */
export interface FactoryCutListGroupHeading {
  boardType: string;
  edgingType: string | null;
  thicknessMm: number | null;
}

export interface FactoryCutListGroup {
  /** Plain-text title (PDF fallback, search). */
  heading: string;
  groupHeading: FactoryCutListGroupHeading;
  rows: FactoryCutListRow[];
}

const MASONITE_ID = 'masonite';

function resolveEdgingMaterialId(job: Job, boardMaterialId: string, override?: string): string {
  if (override) return override;
  return job.materials.find((m) => m.id === boardMaterialId)?.edgingMaterialId ?? '';
}

export function factoryCutListGroupHeading(
  materialName: string,
  tapeKey: string,
): FactoryCutListGroupHeading {
  if (tapeKey === 'masonite' || tapeKey === 'none') {
    return { boardType: materialName, edgingType: null, thicknessMm: null };
  }
  const pipe = tapeKey.lastIndexOf('|');
  return {
    boardType: materialName,
    edgingType: tapeKey.slice(0, pipe),
    thicknessMm: Number(tapeKey.slice(pipe + 1)) || null,
  };
}

export function factoryCutListGroupHeadingPlain(h: FactoryCutListGroupHeading): string {
  let text = `Board type - ${h.boardType}`;
  if (h.edgingType != null && h.thicknessMm != null) {
    text += ` -/- Edging Type - ${h.edgingType} - Thickness - ${h.thicknessMm} mm`;
  }
  return text;
}

function factoryPieceGroupKeys(job: Job, piece: CutPiece): { sortKey: string } {
  const pattern = piece.edgingPattern ?? 'none';
  const edgingMaterialId = resolveEdgingMaterialId(job, piece.materialId, piece.edgingMaterialId);
  const hasEdging = piece.kickplateEdgingCounts
    ? pieceHasKickplateEdging(piece.kickplateEdgingCounts)
    : pattern !== 'none';
  const tapeKey = hasEdging ? edgingTapeKeyFromMaterial(job, edgingMaterialId) : 'none';

  if (piece.materialId === MASONITE_ID) {
    return { sortKey: `${piece.materialName}|masonite` };
  }

  return { sortKey: `${piece.materialName}|${tapeKey}` };
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
  const ticks = piece.kickplateEdgingCounts
    ? kickplateEdgingToFactoryTicks(piece.kickplateEdgingCounts)
    : edgingPatternToFactoryTicks(pattern);
  const longAlong = piece.longAlong ?? 'length';
  const { lengthMm, widthMm } = piece.kickplateEdgingCounts
    ? { lengthMm: piece.length, widthMm: piece.width }
    : factoryCutDimensions(piece.width, piece.length, longAlong);

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
    edgingThickMm:
      pattern === 'none' && !piece.kickplateEdgingCounts
        ? null
        : piece.kickplateEdgingCounts &&
            piece.kickplateEdgingCounts.long <= 0 &&
            piece.kickplateEdgingCounts.short <= 0
          ? null
          : (edgingMat?.thickness ?? null),
    edgingColour:
      pattern === 'none' && !piece.kickplateEdgingCounts
        ? '—'
        : piece.kickplateEdgingCounts &&
            piece.kickplateEdgingCounts.long <= 0 &&
            piece.kickplateEdgingCounts.short <= 0
          ? '—'
          : (edgingMat?.name?.trim() || '—'),
    hingeHoles,
    notes: '',
  };
}

/**
 * Within a board + edging-tape group: merge when cut size and edging ticks match.
 * Board type and edging tape are already the same for every row in the group.
 */
function factoryRowMergeKey(row: FactoryCutListRow): string {
  const e = row.edging;
  return [
    row.lengthMm,
    row.widthMm,
    row.finish,
    e.l1,
    e.l2,
    e.b1,
    e.b2,
    row.edgingThickMm ?? '',
    row.hingeHoles,
  ].join('\0');
}

type MergeAcc = FactoryCutListRow & { sourceLines: number };

/** Same board + edging + size + L/B ticks → one row, qty summed (factory sheet). */
export function mergeFactoryRowsByCutSpec(rows: FactoryCutListRow[]): FactoryCutListRow[] {
  const map = new Map<string, MergeAcc>();
  for (const row of rows) {
    const key = factoryRowMergeKey(row);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...row, edging: { ...row.edging }, sourceLines: 1 });
      continue;
    }
    existing.qty += row.qty;
    existing.sourceLines += 1;
  }
  return Array.from(map.values()).map(({ sourceLines, ...row }) => {
    if (sourceLines > 1) {
      return { ...row, unitId: '—', description: '—' };
    }
    return row;
  });
}

function sortFactoryRows(a: FactoryCutListRow, b: FactoryCutListRow): number {
  return (
    b.lengthMm - a.lengthMm ||
    b.widthMm - a.widthMm ||
    a.description.localeCompare(b.description) ||
    a.unitId.localeCompare(b.unitId)
  );
}

/** One section per board + edging tape (matches Full/Factory board groups). */
export function buildFactoryCutListGroups(job: Job, pieces: CutPiece[]): FactoryCutListGroup[] {
  const map = new Map<string, { materialName: string; tapeKey: string; rows: FactoryCutListRow[] }>();

  for (const piece of pieces) {
    if (piece.qty <= 0) continue;
    const { sortKey } = factoryPieceGroupKeys(job, piece);
    const pipe = sortKey.indexOf('|');
    const materialName = sortKey.slice(0, pipe);
    const tapeKey = sortKey.slice(pipe + 1);
    const entry = map.get(sortKey) ?? { materialName, tapeKey, rows: [] };
    entry.rows.push(pieceToFactoryRow(job, piece));
    map.set(sortKey, entry);
  }

  return Array.from(map.values())
    .sort((a, b) => {
      const matCmp = a.materialName.localeCompare(b.materialName);
      if (matCmp !== 0) return matCmp;
      if ((a.tapeKey === 'none') !== (b.tapeKey === 'none')) return a.tapeKey === 'none' ? 1 : -1;
      if (a.tapeKey === 'masonite' && b.tapeKey === 'masonite') return 0;
      return a.tapeKey.localeCompare(b.tapeKey, undefined, { numeric: true });
    })
    .map(({ materialName, tapeKey, rows }) => {
      const groupHeading = factoryCutListGroupHeading(materialName, tapeKey);
      return {
        heading: factoryCutListGroupHeadingPlain(groupHeading),
        groupHeading,
        rows: mergeFactoryRowsByCutSpec(rows).sort(sortFactoryRows),
      };
    });
}

export function buildFactoryCutListRows(job: Job, pieces: CutPiece[]): FactoryCutListRow[] {
  return buildFactoryCutListGroups(job, pieces).flatMap((g) => g.rows);
}

/** On-screen factory table (browser fonts render this reliably). */
export function factoryTickCell(on: boolean): string {
  return on ? '✓' : '';
}

/** PDF: Helvetica cannot render ✓ — draw ticks in pdf.ts instead; cells stay empty. */
export function factoryTickCellPdf(_on: boolean): string {
  return '';
}

/** Fixed mm size — must not scale with row height (wrapped Unit ID rows). */
const FACTORY_TICK_HEIGHT_MM = 3;
const FACTORY_TICK_WIDTH_MM = 2.6;

type HeadingTextPart = { text: string; bold: boolean };

function factoryGroupHeadingParts(h: FactoryCutListGroupHeading): HeadingTextPart[] {
  const parts: HeadingTextPart[] = [
    { text: 'Board type', bold: true },
    { text: ` - ${h.boardType}`, bold: false },
  ];
  if (h.edgingType != null && h.thicknessMm != null) {
    parts.push(
      { text: ' -/- ', bold: false },
      { text: 'Edging Type', bold: true },
      { text: ` - ${h.edgingType}`, bold: false },
      { text: ' - ', bold: false },
      { text: 'Thickness', bold: true },
      { text: ` - ${h.thicknessMm} mm`, bold: false },
    );
  }
  return parts;
}

/** Factory PDF group title — bold labels, black text. */
export function drawFactoryCutListGroupHeading(
  doc: jsPDF,
  margin: number,
  y: number,
  h: FactoryCutListGroupHeading,
): number {
  doc.setFontSize(11);
  doc.setTextColor(0);
  let x = margin;
  for (const part of factoryGroupHeadingParts(h)) {
    doc.setFont('helvetica', part.bold ? 'bold' : 'normal');
    doc.text(part.text, x, y);
    x += doc.getTextWidth(part.text);
  }
  return y + 5;
}

export function drawFactoryEdgingTick(
  doc: jsPDF,
  cell: { x: number; y: number; width: number; height: number },
): void {
  const cx = cell.x + cell.width / 2;
  const cy = cell.y + cell.height / 2;
  const h = FACTORY_TICK_HEIGHT_MM;
  const w = FACTORY_TICK_WIDTH_MM;

  doc.setDrawColor(20);
  doc.setLineWidth(0.35);
  const x1 = cx - w * 0.38;
  const y1 = cy + h * 0.06;
  const x2 = cx - w * 0.05;
  const y2 = cy + h * 0.4;
  const x3 = cx + w * 0.42;
  const y3 = cy - h * 0.36;
  doc.line(x1, y1, x2, y2);
  doc.line(x2, y2, x3, y3);
}
