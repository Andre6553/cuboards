import type { CarcassConfig, EdgingPattern, Material, Unit, VisibleBackPanelConfig } from '../types';
import { activeDrawers, resolveDrawerFrontMaterialId } from './drawerRules';

export type { VisibleBackPanelConfig };

export function defaultVisibleBackPanel(unit: Pick<Unit, 'width' | 'height'>): VisibleBackPanelConfig {
  return {
    enabled: false,
    widthMm: unit.width,
    heightMm: unit.height,
  };
}

export function normalizeVisibleBackPanel(
  unit: Pick<Unit, 'width' | 'height'>,
  carcass: CarcassConfig,
): VisibleBackPanelConfig | undefined {
  const raw = carcass.visibleBackPanel;
  if (!raw?.enabled) return raw?.enabled === false ? raw : undefined;
  return {
    enabled: true,
    widthMm: raw.widthMm > 0 ? raw.widthMm : unit.width,
    heightMm: raw.heightMm > 0 ? raw.heightMm : unit.height,
    materialId: raw.materialId,
    edgingPattern: raw.edgingPattern,
    edgingMaterialId: raw.edgingMaterialId,
  };
}

/** First door, else first active drawer front — else filler material. */
export function resolveVisibleBackPanelMaterialId(unit: Unit, materials: Material[]): string {
  const override = unit.carcass.visibleBackPanel?.materialId;
  if (override) return override;
  const door = unit.doors[0];
  if (door?.materialId) return door.materialId;
  const drawer = activeDrawers(unit.drawers)[0];
  if (drawer) return resolveDrawerFrontMaterialId(drawer);
  return unit.carcass.fillerMaterialId || materials[0]?.id || '';
}

export function resolveVisibleBackPanelEdging(
  unit: Unit,
  boardMaterialId: string,
  materials: Material[],
): { pattern: EdgingPattern; edgingMaterialId: string } {
  const v = unit.carcass.visibleBackPanel;
  if (v?.edgingMaterialId) {
    return {
      pattern: v.edgingPattern ?? '2_long_2_short',
      edgingMaterialId: v.edgingMaterialId,
    };
  }
  const door = unit.doors[0];
  if (door?.edgingMaterialId) {
    return { pattern: door.edgingPattern, edgingMaterialId: door.edgingMaterialId };
  }
  const drawer = activeDrawers(unit.drawers)[0];
  if (drawer?.frontEdgingMaterialId) {
    return {
      pattern: drawer.frontEdgingPattern ?? '2_long_2_short',
      edgingMaterialId: drawer.frontEdgingMaterialId,
    };
  }
  const boardMat = materials.find((m) => m.id === boardMaterialId);
  return {
    pattern: '2_long_2_short',
    edgingMaterialId: boardMat?.edgingMaterialId ?? '',
  };
}
