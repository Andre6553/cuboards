import gelmarRaw from '../data/gelmarRunners.json';

export type RunnerSource = 'brand' | 'gelmar';

export interface RunnerCatalogEntry {
  id: string;
  name: string;
  shortName: string;
  source: RunnerSource;
  category: string;
  categoryLabel: string;
  sku?: string;
  lengthMm?: number;
  profileHeightMm?: number;
  capacityKg?: number;
  colour?: string;
  sideClearance: number;
  depthDeduction: number;
  runnerLengthOffset: number;
  defaultPrice: number;
  url?: string;
}

/** Premium / brand runners (Blum, Hettich, etc.) — lengths calculated from cupboard depth. */
export const BRAND_RUNNER_PRESETS: Omit<RunnerCatalogEntry, 'source' | 'category' | 'categoryLabel' | 'shortName'>[] = [
  {
    id: 'blum-tandem',
    name: 'Blum Tandem (563)',
    sideClearance: 13,
    depthDeduction: 25,
    runnerLengthOffset: 26,
    defaultPrice: 450,
  },
  {
    id: 'blum-movento',
    name: 'Blum Movento',
    sideClearance: 12.5,
    depthDeduction: 25,
    runnerLengthOffset: 26,
    defaultPrice: 680,
  },
  {
    id: 'hettich-innotech',
    name: 'Hettich InnoTech',
    sideClearance: 12.7,
    depthDeduction: 27,
    runnerLengthOffset: 28,
    defaultPrice: 420,
  },
  {
    id: 'generic-13',
    name: 'Generic 13mm clearance',
    sideClearance: 13,
    depthDeduction: 25,
    runnerLengthOffset: 26,
    defaultPrice: 280,
  },
];

export const RUNNER_CATEGORY_ORDER = [
  'brand',
  'ball_bearing',
  'soft_close',
  'push_open',
  'roller',
  'metal_drawer_side',
] as const;

export const RUNNER_CATEGORY_LABELS: Record<string, string> = {
  brand: 'Blum / Hettich / generic',
  ball_bearing: 'Gelmar — ball bearing',
  soft_close: 'Gelmar — soft close',
  push_open: 'Gelmar — push open',
  roller: 'Gelmar — roller',
  metal_drawer_side: 'Gelmar — metal drawer side',
};

function parseGelmarTitle(title: string, category: string) {
  const profileHeightMm = title.match(/Runner,\s*(\d+)mm/)?.[1] ?? title.match(/,\s*(\d+)mm,/)?.[1];
  const lengthMm =
    title.match(/,\s*(\d+)mm,/)?.[1] ??
    title.match(/Roller Runner,\s*(\d+)mm/)?.[1] ??
    title.match(/Metal Drawer Side,\s*(\d+)mm/)?.[1];
  const capacityKg = title.match(/(\d+)kg\s*Capacity/i)?.[1];
  const colour = title.match(/\b(White|Black)\b/i)?.[1];
  const sideHeightMm = title.match(/H(\d+),/i)?.[1];

  return {
    profileHeightMm: profileHeightMm ? Number(profileHeightMm) : undefined,
    lengthMm: lengthMm ? Number(lengthMm) : undefined,
    capacityKg: capacityKg ? Number(capacityKg) : undefined,
    colour: colour ? colour[0].toUpperCase() + colour.slice(1).toLowerCase() : undefined,
    sideHeightMm: sideHeightMm ? Number(sideHeightMm) : undefined,
    parsedCategory:
      title.startsWith('Metal Drawer Side') ? 'metal_drawer_side' : category,
  };
}

function gelmarMechanical(category: string, title: string) {
  if (category === 'roller') return { sideClearance: 10, depthDeduction: 18 };
  if (category === 'metal_drawer_side') return { sideClearance: 13, depthDeduction: 25 };
  if (title.includes('35mm')) return { sideClearance: 12.7, depthDeduction: 25 };
  if (title.includes('42mm')) return { sideClearance: 13, depthDeduction: 25 };
  if (title.includes('45mm')) return { sideClearance: 13, depthDeduction: 25 };
  return { sideClearance: 13, depthDeduction: 25 };
}

function gelmarShortName(title: string, sku?: string, priceZar?: number | null) {
  const parsed = parseGelmarTitle(title, '');
  const bits = [
    parsed.lengthMm ? `${parsed.lengthMm} mm` : undefined,
    parsed.profileHeightMm ? `${parsed.profileHeightMm} mm profile` : undefined,
    parsed.colour,
    parsed.capacityKg ? `${parsed.capacityKg} kg` : undefined,
    sku ? `SKU ${sku}` : undefined,
    priceZar != null ? `R ${priceZar.toFixed(2)}` : undefined,
  ].filter(Boolean);
  return bits.join(' · ');
}

function buildGelmarCatalog(): RunnerCatalogEntry[] {
  return gelmarRaw.runners.map((r) => {
    const parsed = parseGelmarTitle(r.title, r.category);
    const category = parsed.parsedCategory;
    const mech = gelmarMechanical(category, r.title);
    const id = `gelmar-${r.sku ?? r.title.replace(/\W+/g, '-').slice(0, 40)}`;
    return {
      id,
      name: r.title,
      shortName: gelmarShortName(r.title, r.sku, r.priceZar),
      source: 'gelmar',
      category,
      categoryLabel: RUNNER_CATEGORY_LABELS[category] ?? r.categoryLabel,
      sku: r.sku,
      lengthMm: parsed.lengthMm,
      profileHeightMm: parsed.profileHeightMm,
      capacityKg: parsed.capacityKg,
      colour: parsed.colour,
      sideClearance: mech.sideClearance,
      depthDeduction: mech.depthDeduction,
      runnerLengthOffset: 26,
      defaultPrice: r.priceZar ?? 0,
      url: r.url,
    };
  });
}

function buildBrandCatalog(): RunnerCatalogEntry[] {
  return BRAND_RUNNER_PRESETS.map((p) => ({
    ...p,
    shortName: p.name,
    source: 'brand' as const,
    category: 'brand',
    categoryLabel: RUNNER_CATEGORY_LABELS.brand,
  }));
}

export const GELMAR_RUNNERS = buildGelmarCatalog();
export const RUNNER_CATALOG: RunnerCatalogEntry[] = [...buildBrandCatalog(), ...GELMAR_RUNNERS];

export function getRunnerById(id?: string): RunnerCatalogEntry | undefined {
  if (!id) return undefined;
  return RUNNER_CATALOG.find((r) => r.id === id);
}

export function getRunnerGroups(): { category: string; label: string; runners: RunnerCatalogEntry[] }[] {
  const map = new Map<string, RunnerCatalogEntry[]>();
  for (const r of RUNNER_CATALOG) {
    const list = map.get(r.category) ?? [];
    list.push(r);
    map.set(r.category, list);
  }
  return RUNNER_CATEGORY_ORDER.filter((c) => map.has(c)).map((category) => ({
    category,
    label: RUNNER_CATEGORY_LABELS[category] ?? category,
    runners: (map.get(category) ?? []).sort((a, b) => (a.lengthMm ?? 0) - (b.lengthMm ?? 0) || a.name.localeCompare(b.name)),
  }));
}

export function getDefaultRunnerPrices(): Record<string, number> {
  return Object.fromEntries(RUNNER_CATALOG.map((r) => [r.id, r.defaultPrice]));
}

export function getRunnerClearances(runner: {
  type: 'preset' | 'custom';
  presetId?: string;
  customSideClearance?: number;
  customDepthDeduction?: number;
}) {
  if (runner.type === 'custom') {
    return {
      sideClearance: runner.customSideClearance ?? 13,
      depthDeduction: runner.customDepthDeduction ?? 25,
      runnerLengthOffset: 26,
    };
  }
  const entry = getRunnerById(runner.presetId);
  if (!entry) {
    return { sideClearance: 13, depthDeduction: 25, runnerLengthOffset: 26 };
  }
  return {
    sideClearance: entry.sideClearance,
    depthDeduction: entry.depthDeduction,
    runnerLengthOffset: entry.runnerLengthOffset,
    fixedLengthMm: entry.lengthMm,
    entry,
  };
}

/** Smallest Gelmar SKU length that fits the cupboard depth (with 26 mm rear gap). */
export function suggestGelmarRunnerId(category: string, cupboardDepthMm: number): string | undefined {
  const need = cupboardDepthMm - 26;
  const candidates = GELMAR_RUNNERS.filter((r) => r.category === category && r.lengthMm != null)
    .sort((a, b) => (a.lengthMm ?? 0) - (b.lengthMm ?? 0));
  return candidates.find((r) => (r.lengthMm ?? 0) >= need)?.id ?? candidates.at(-1)?.id;
}

export const GELMAR_SCRAPED_AT = gelmarRaw.scrapedAt;
