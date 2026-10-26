import { DEFAULT_EDGING, DEFAULT_MATERIALS } from './constants';
import {
  loadMaterialCatalog,
  mergeIntoMaterialCatalog,
  type BoardCatalog,
} from './materialCatalog';
import { getSupabase } from './supabaseClient';
import { requireUserDataScope } from './userDataScope';
import type { EdgingMaterial, Material, SheetPurchaseUnit } from '../types';

export interface CommunityMaterialsPrefs {
  acceptUpdates: boolean;
}

export interface CommunityMaterialOffer {
  community_key: string;
  name: string;
  colour: string;
  has_grain: boolean;
  sheet_purchase_unit: string;
  edging_name: string;
  edging_thickness: number;
  suggested_price_per_sheet: number | null;
  created_at: string;
}

const PREFS_KEY_SUFFIX = 'cuboards_community_materials_prefs';

function prefsStorageKey(): string {
  return `${PREFS_KEY_SUFFIX}_${requireUserDataScope()}`;
}

export function loadCommunityMaterialsPrefs(): CommunityMaterialsPrefs {
  try {
    requireUserDataScope();
    const raw = localStorage.getItem(prefsStorageKey());
    if (raw) {
      const o = JSON.parse(raw) as CommunityMaterialsPrefs;
      return { acceptUpdates: Boolean(o.acceptUpdates) };
    }
  } catch {
    /* ignore */
  }
  return { acceptUpdates: false };
}

export function saveCommunityMaterialsPrefs(prefs: CommunityMaterialsPrefs): void {
  requireUserDataScope();
  localStorage.setItem(prefsStorageKey(), JSON.stringify(prefs));
}

export function applyCommunityMaterialsPrefsFromCloud(accept: boolean | null | undefined): void {
  if (accept == null) return;
  saveCommunityMaterialsPrefs({ acceptUpdates: accept });
  try {
    window.dispatchEvent(new CustomEvent('cuboards-community-prefs'));
  } catch {
    /* ignore */
  }
}

export function communityKeyFromMaterial(m: Pick<Material, 'name' | 'colour'>): string {
  const name = m.name.trim().toLowerCase();
  const colour = m.colour.trim().toLowerCase();
  return `${name}|${colour}`;
}

function isPlaceholderMaterial(m: Material): boolean {
  const name = m.name.trim().toLowerCase();
  return name === '' || name === 'new material';
}

const defaultCommunityKeys = new Set(DEFAULT_MATERIALS.map((m) => communityKeyFromMaterial(m)));

function edgingLabelForMaterial(m: Material, edgingMaterials: EdgingMaterial[]): { name: string; thickness: number } {
  const edge = edgingMaterials.find((e) => e.id === m.edgingMaterialId);
  return { name: edge?.name ?? '', thickness: edge?.thickness ?? 1 };
}

export async function publishCommunityMaterialsFromCatalog(catalog: BoardCatalog | null): Promise<void> {
  if (!catalog?.materials?.length) return;
  const supabase = getSupabase();
  for (const m of catalog.materials) {
    if (isPlaceholderMaterial(m)) continue;
    const key = communityKeyFromMaterial(m);
    if (!key || key === '|' || defaultCommunityKeys.has(key)) continue;
    const edge = edgingLabelForMaterial(m, catalog.edgingMaterials);
    const { error } = await supabase.rpc('publish_community_board_material', {
      p_community_key: key,
      p_name: m.name.trim(),
      p_colour: m.colour.trim(),
      p_has_grain: m.hasGrain,
      p_sheet_purchase_unit: m.sheetPurchaseUnit ?? 'quarter',
      p_edging_name: edge.name,
      p_edging_thickness: edge.thickness,
      p_suggested_price: m.pricePerSheet > 0 ? m.pricePerSheet : null,
    });
    if (error) console.error('publish_community_board_material', key, error.message);
  }
}

export async function fetchPendingCommunityMaterials(): Promise<CommunityMaterialOffer[]> {
  if (!loadCommunityMaterialsPrefs().acceptUpdates) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('list_pending_community_materials');
  if (error) {
    console.error('list_pending_community_materials', error);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data as CommunityMaterialOffer[];
}

export async function dismissCommunityMaterial(communityKey: string): Promise<void> {
  const supabase = getSupabase();
  await supabase.rpc('dismiss_community_board_material', { p_community_key: communityKey });
}

export async function markCommunityMaterialsSeen(): Promise<void> {
  const supabase = getSupabase();
  await supabase.rpc('mark_community_materials_seen');
}

function resolveEdgingId(
  edgingMaterials: EdgingMaterial[],
  name: string,
  thickness: number,
): { edgingMaterials: EdgingMaterial[]; edgingId: string } {
  const match = edgingMaterials.find(
    (e) => e.name.trim().toLowerCase() === name.trim().toLowerCase() && e.thickness === thickness,
  );
  if (match) return { edgingMaterials, edgingId: match.id };

  const created: EdgingMaterial = {
    id: crypto.randomUUID(),
    name: name.trim() || 'Edging',
    thickness,
    pricePerMetre: 10,
  };
  return { edgingMaterials: [...edgingMaterials, created], edgingId: created.id };
}

export function acceptCommunityMaterialIntoCatalog(
  offer: CommunityMaterialOffer,
  draft: {
    pricePerSheet: number;
    hasGrain: boolean;
    sheetPurchaseUnit: SheetPurchaseUnit;
    edgingMaterialId: string;
  },
): BoardCatalog {
  const current = loadMaterialCatalog() ?? {
    materials: DEFAULT_MATERIALS.map((m) => ({ ...m })),
    edgingMaterials: DEFAULT_EDGING.map((e) => ({ ...e })),
    savedAt: new Date().toISOString(),
  };

  const edgingMaterials = current.edgingMaterials;
  let edgingMaterialId = draft.edgingMaterialId;
  let extraEdging: EdgingMaterial[] = [];
  const existingEdge = edgingMaterials.find((e) => e.id === edgingMaterialId);
  if (!existingEdge) {
    const resolved = resolveEdgingId(edgingMaterials, offer.edging_name, offer.edging_thickness);
    edgingMaterialId = resolved.edgingId;
    if (resolved.edgingMaterials.length > edgingMaterials.length) {
      extraEdging = resolved.edgingMaterials.slice(edgingMaterials.length);
    }
  }

  const material: Material = {
    id: crypto.randomUUID(),
    name: offer.name,
    colour: offer.colour,
    pricePerSheet: draft.pricePerSheet,
    hasGrain: draft.hasGrain,
    sheetPurchaseUnit: draft.sheetPurchaseUnit,
    edgingMaterialId,
  };

  return mergeIntoMaterialCatalog([material], extraEdging);
}

export function communityOfferToDraft(
  offer: CommunityMaterialOffer,
  catalog: BoardCatalog | null,
): {
  pricePerSheet: number;
  hasGrain: boolean;
  sheetPurchaseUnit: SheetPurchaseUnit;
  edgingMaterialId: string;
} {
  const edgingMaterials = catalog?.edgingMaterials ?? DEFAULT_EDGING;
  const match = edgingMaterials.find(
    (e) =>
      e.name.trim().toLowerCase() === offer.edging_name.trim().toLowerCase() &&
      e.thickness === Number(offer.edging_thickness),
  );
  const unit = (offer.sheet_purchase_unit ?? 'quarter') as SheetPurchaseUnit;
  return {
    pricePerSheet: offer.suggested_price_per_sheet ?? 0,
    hasGrain: offer.has_grain,
    sheetPurchaseUnit: unit,
    edgingMaterialId: match?.id ?? edgingMaterials[0]?.id ?? '',
  };
}
