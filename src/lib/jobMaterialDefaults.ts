import type { EdgingMaterial, Job, JobSettings, Material } from '../types';

export type ResolvedJobMaterialDefaults = {
  visibleSideMaterialId: string;
  carcassMaterialId: string;
  carcassEdgingMaterialId: string;
  doorMaterialId: string;
  doorEdgingMaterialId: string;
  drawerFrontMaterialId: string;
  drawerFrontEdgingMaterialId: string;
  /** Drawer box follows carcass board + carcass edging. */
  drawerBoxMaterialId: string;
  drawerBoxEdgingMaterialId: string;
};

function boardExists(materials: Material[], id: string | undefined): id is string {
  return Boolean(id && materials.some((m) => m.id === id));
}

function edgingExists(edging: EdgingMaterial[], id: string | undefined): id is string {
  return Boolean(id && edging.some((e) => e.id === id));
}

function linkedEdging(
  materials: Material[],
  edging: EdgingMaterial[],
  materialId: string,
): string {
  const mat = materials.find((m) => m.id === materialId);
  if (mat?.edgingMaterialId && edgingExists(edging, mat.edgingMaterialId)) {
    return mat.edgingMaterialId;
  }
  return edging[0]?.id ?? '';
}

/**
 * Resolve job-local material/edging defaults for new units, doors, and drawers.
 * Missing or unknown IDs fall back to materials[0]/[1] and board-linked edging.
 */
export function resolveJobMaterialDefaults(
  job: Pick<Job, 'materials' | 'edgingMaterials' | 'settings'>,
): ResolvedJobMaterialDefaults {
  const materials = job.materials ?? [];
  const edging = job.edgingMaterials ?? [];
  const s = job.settings ?? ({} as JobSettings);

  const legacyCarcass = materials[0]?.id ?? 'mat-white';
  const legacyVisible = materials[1]?.id ?? legacyCarcass;

  const carcassMaterialId = boardExists(materials, s.defaultCarcassMaterialId)
    ? s.defaultCarcassMaterialId
    : legacyCarcass;
  const visibleSideMaterialId = boardExists(materials, s.defaultVisibleSideMaterialId)
    ? s.defaultVisibleSideMaterialId
    : legacyVisible;

  const carcassEdgingMaterialId = edgingExists(edging, s.defaultCarcassEdgingMaterialId)
    ? s.defaultCarcassEdgingMaterialId
    : linkedEdging(materials, edging, carcassMaterialId);

  const doorMaterialId = boardExists(materials, s.defaultDoorMaterialId)
    ? s.defaultDoorMaterialId
    : visibleSideMaterialId;
  const doorEdgingMaterialId = edgingExists(edging, s.defaultDoorEdgingMaterialId)
    ? s.defaultDoorEdgingMaterialId
    : linkedEdging(materials, edging, doorMaterialId);

  const drawerFrontMaterialId = boardExists(materials, s.defaultDrawerFrontMaterialId)
    ? s.defaultDrawerFrontMaterialId
    : doorMaterialId;
  const drawerFrontEdgingMaterialId = edgingExists(edging, s.defaultDrawerFrontEdgingMaterialId)
    ? s.defaultDrawerFrontEdgingMaterialId
    : linkedEdging(materials, edging, drawerFrontMaterialId);

  return {
    visibleSideMaterialId,
    carcassMaterialId,
    carcassEdgingMaterialId,
    doorMaterialId,
    doorEdgingMaterialId,
    drawerFrontMaterialId,
    drawerFrontEdgingMaterialId,
    drawerBoxMaterialId: carcassMaterialId,
    drawerBoxEdgingMaterialId: carcassEdgingMaterialId,
  };
}

/** Strip per-job material defaults so account price-list / Save defaults never carry them. */
export function omitJobMaterialDefaultsFromSettings(settings: JobSettings): JobSettings {
  const {
    defaultVisibleSideMaterialId: _v,
    defaultCarcassMaterialId: _c,
    defaultCarcassEdgingMaterialId: _ce,
    defaultDoorMaterialId: _d,
    defaultDoorEdgingMaterialId: _de,
    defaultDrawerFrontMaterialId: _df,
    defaultDrawerFrontEdgingMaterialId: _dfe,
    ...rest
  } = settings;
  return rest;
}
