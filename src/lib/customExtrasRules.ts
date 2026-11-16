import type { CustomExtraPart, CustomExtraPartKind, EdgingPattern, Job, Unit } from '../types';
import type { LongAlong } from './edgingCutSize';
import { extrasSectionEnabled } from './extrasRules';

export function usesBedroomExtrasForm(unit: Pick<Unit, 'type'>): boolean {
  return unit.type === 'bedroom';
}

export function usesCustomExtrasForm(unit: Pick<Unit, 'type'>): boolean {
  return unit.type === 'kitchen_base' || unit.type === 'wall';
}

const KIND_LABEL: Record<CustomExtraPartKind, string> = {
  door: 'Door',
  panel: 'Panel',
  filler: 'Filler',
};

export function defaultCustomExtraPart(
  unit: Unit,
  job: Job,
  kind: CustomExtraPartKind = 'panel',
): CustomExtraPart {
  const materialId = unit.carcass.leftMaterialId || job.materials[0]?.id || '';
  const mat = job.materials.find((m) => m.id === materialId);
  const edgingMaterialId = mat?.edgingMaterialId ?? job.edgingMaterials[0]?.id ?? '';
  const fillerW = Math.max(1, Math.round(unit.carcass.fillerWidth ?? 100));
  const defaults: Record<
    CustomExtraPartKind,
    { length: number; width: number; edgingPattern: EdgingPattern }
  > = {
    door: { length: Math.round(unit.height), width: Math.round(unit.width), edgingPattern: '2_long_2_short' },
    panel: { length: Math.round(unit.height), width: Math.round(unit.depth), edgingPattern: '1_long_2_short' },
    filler: { length: Math.round(unit.height), width: fillerW, edgingPattern: '1_long' },
  };
  const d = defaults[kind];
  return {
    id: crypto.randomUUID(),
    kind,
    label: '',
    length: d.length,
    width: d.width,
    qty: 1,
    materialId,
    edgingPattern: d.edgingPattern,
    edgingMaterialId,
  };
}

export function customExtraPartName(part: CustomExtraPart): string {
  const base = `Extra · ${KIND_LABEL[part.kind]}`;
  const label = part.label.trim();
  return label ? `${base} (${label})` : base;
}

export interface CustomExtraBoardCut {
  partName: string;
  width: number;
  length: number;
  qty: number;
  kind: CustomExtraPartKind;
  materialId: string;
  edgingPattern: EdgingPattern;
  edgingMaterialId: string;
  longAlong: LongAlong;
  grainHint: 'vertical' | 'none';
}

export function customExtrasForCutList(unit: Unit): CustomExtraPart[] {
  if (!extrasSectionEnabled(unit) || !usesCustomExtrasForm(unit)) return [];
  return (unit.customExtras ?? []).filter((p) => p.qty > 0 && p.length > 0 && p.width > 0);
}

export function customExtraBoardCuts(parts: CustomExtraPart[]): CustomExtraBoardCut[] {
  const cuts: CustomExtraBoardCut[] = [];
  for (const part of parts) {
    if (part.qty <= 0 || part.length <= 0 || part.width <= 0) continue;
    cuts.push({
      partName: customExtraPartName(part),
      width: Math.round(part.width),
      length: Math.round(part.length),
      qty: Math.max(1, Math.round(part.qty)),
      kind: part.kind,
      materialId: part.materialId,
      edgingPattern: part.edgingPattern,
      edgingMaterialId: part.edgingMaterialId,
      longAlong: 'length',
      grainHint: part.kind === 'door' ? 'vertical' : 'none',
    });
  }
  return cuts;
}