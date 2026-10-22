import type { Unit, UnitPreset } from '../types';
import { scheduleCloudPrefsPush } from './cloudPrefsPush';
import { requireUserDataScope, userStorageKeys } from './userDataScope';

export interface UnitPresetsBundle {
  presets: UnitPreset[];
  savedAt: string;
}

const LEGACY_PRESETS_KEY = 'cuboards_unit_presets';

function parsePresetsPayload(raw: string): UnitPreset[] {
  const parsed = JSON.parse(raw) as UnitPreset[] | UnitPresetsBundle;
  if (Array.isArray(parsed)) return parsed;
  return parsed.presets ?? [];
}

function loadBundle(): UnitPresetsBundle {
  requireUserDataScope();
  const raw = localStorage.getItem(userStorageKeys.unitPresets());
  if (!raw) return { presets: [], savedAt: '' };
  try {
    const parsed = JSON.parse(raw) as UnitPresetsBundle;
    if (Array.isArray(parsed)) {
      return { presets: parsed, savedAt: '' };
    }
    return { presets: parsed.presets ?? [], savedAt: parsed.savedAt ?? '' };
  } catch {
    return { presets: [], savedAt: '' };
  }
}

export function loadPresetsBundle(): UnitPresetsBundle {
  return loadBundle();
}

export function loadPresets(): UnitPreset[] {
  return loadBundle().presets;
}

export function writePresetsBundle(bundle: UnitPresetsBundle): void {
  requireUserDataScope();
  localStorage.setItem(userStorageKeys.unitPresets(), JSON.stringify(bundle));
}

export function savePresets(presets: UnitPreset[]): void {
  writePresetsBundle({
    presets,
    savedAt: new Date().toISOString(),
  });
  scheduleCloudPrefsPush();
}

export function saveUnitAsPreset(unit: Unit, presetName: string): UnitPreset {
  const preset: UnitPreset = {
    id: crypto.randomUUID(),
    name: presetName,
    createdAt: new Date().toISOString(),
    template: {
      type: unit.type,
      width: unit.width,
      height: unit.height,
      depth: unit.depth,
      carcass: { ...unit.carcass },
      plinth: unit.plinth ? { ...unit.plinth } : undefined,
      doors: unit.doors.map((d) => ({ ...d, id: d.id })),
      drawers: unit.drawers.map((d) => ({ ...d, id: d.id })),
    },
  };
  const presets = loadPresets();
  savePresets([preset, ...presets]);
  return preset;
}

export function deletePreset(id: string): void {
  savePresets(loadPresets().filter((p) => p.id !== id));
}

export function unitFromPreset(preset: UnitPreset): Unit {
  return {
    id: crypto.randomUUID(),
    name: preset.name,
    unitQty: 1,
    type: preset.template.type,
    width: preset.template.width,
    height: preset.template.height,
    depth: preset.template.depth,
    carcass: { ...preset.template.carcass },
    plinth: preset.template.plinth ? { ...preset.template.plinth } : undefined,
    doors: preset.template.doors.map((d) => ({ ...d, id: crypto.randomUUID() })),
    drawers: preset.template.drawers.map((d) => ({ ...d, id: crypto.randomUUID() })),
  };
}

export function mergePresetBundles(local: UnitPresetsBundle, remote: UnitPresetsBundle): UnitPresetsBundle {
  const map = new Map<string, UnitPreset>();
  for (const p of remote.presets) map.set(p.id, p);
  for (const p of local.presets) {
    const existing = map.get(p.id);
    if (!existing || p.createdAt.localeCompare(existing.createdAt) > 0) {
      map.set(p.id, p);
    }
  }
  const presets = [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const savedAt =
    [local.savedAt, remote.savedAt].filter(Boolean).sort().reverse()[0] ?? new Date().toISOString();
  return { presets, savedAt };
}

/** Import legacy global presets into this account once. */
export function adoptLegacyUnitPresetsIfEmpty(): boolean {
  requireUserDataScope();
  if (localStorage.getItem(userStorageKeys.unitPresets())) return false;
  const legacy = localStorage.getItem(LEGACY_PRESETS_KEY);
  if (!legacy) return false;
  try {
    const presets = parsePresetsPayload(legacy);
    if (presets.length === 0) return false;
    savePresets(presets);
    localStorage.removeItem(LEGACY_PRESETS_KEY);
    return true;
  } catch {
    return false;
  }
}
