import type { Unit, UnitPreset } from '../types';

const PRESETS_KEY = 'cuboards_unit_presets';

export function loadPresets(): UnitPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as UnitPreset[];
  } catch {
    return [];
  }
}

export function savePresets(presets: UnitPreset[]): void {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
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
