import { UNIT_TYPE_LABELS } from './constants';
import type { CutPiece, CutPieceCategory, Job } from '../types';

const CATEGORY_ORDER: CutPieceCategory[] = ['carcass', 'door', 'drawer'];

function categoryRank(category: CutPieceCategory): number {
  const i = CATEGORY_ORDER.indexOf(category);
  return i >= 0 ? i : CATEGORY_ORDER.length;
}

function comparePiecesInUnit(a: CutPiece, b: CutPiece): number {
  return (
    categoryRank(a.category) - categoryRank(b.category) ||
    a.materialName.localeCompare(b.materialName) ||
    a.partName.localeCompare(b.partName) ||
    b.length - a.length ||
    b.width - a.width ||
    a.edgingPattern?.localeCompare(b.edgingPattern ?? '') ||
    0
  );
}

function pieceUnitKey(piece: CutPiece): string {
  return piece.unitId || piece.unitName;
}

export interface PerUnitBreakdownSection {
  unitId: string;
  unitName: string;
  unitTypeLabel: string;
  unitQty: number;
  sizeLabel: string;
  pieces: CutPiece[];
}

/**
 * One section per job unit row (cupboard line), with every cut size listed — no merge across units
 * or by unit type + material (that consolidation lives on the board cut list only).
 */
export function buildPerUnitBreakdownSections(job: Job, pieces: CutPiece[]): PerUnitBreakdownSection[] {
  const byUnit = new Map<string, CutPiece[]>();
  for (const p of pieces) {
    if (p.qty <= 0) continue;
    const key = pieceUnitKey(p);
    const list = byUnit.get(key) ?? [];
    list.push(p);
    byUnit.set(key, list);
  }

  const sections: PerUnitBreakdownSection[] = [];

  for (const unit of job.units) {
    const unitQty = Math.max(0, unit.unitQty ?? 0);
    if (unitQty <= 0) continue;

    const keyed = byUnit.get(unit.id) ?? byUnit.get(unit.name) ?? [];
    byUnit.delete(unit.id);
    byUnit.delete(unit.name);

    const sorted = [...keyed].sort(comparePiecesInUnit);
    sections.push({
      unitId: unit.id,
      unitName: unit.name,
      unitTypeLabel: UNIT_TYPE_LABELS[unit.type],
      unitQty,
      sizeLabel: `${unit.width} × ${unit.height} × ${unit.depth} mm`,
      pieces: sorted,
    });
  }

  for (const [key, orphaned] of byUnit) {
    if (orphaned.length === 0) continue;
    const name = orphaned[0]?.unitName ?? key;
    sections.push({
      unitId: key,
      unitName: name,
      unitTypeLabel: '—',
      unitQty: 0,
      sizeLabel: '—',
      pieces: [...orphaned].sort(comparePiecesInUnit),
    });
  }

  return sections;
}