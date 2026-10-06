import gelmarRaw from '../data/gelmarHinges.json';

export type HingeOverlay =
  | 'full'
  | 'half'
  | 'inset'
  | 'blind_corner'
  | 'bifold_corner'
  | 'zero_protrusion'
  | 'other';

export interface HingeCatalogEntry {
  id: string;
  name: string;
  shortName: string;
  category: string;
  categoryLabel: string;
  sku?: string;
  overlay: HingeOverlay;
  angleDeg?: number;
  /** Overlay crank / inset offset (mm) — e.g. 0 full, 10 half, 16 inset */
  crankMm?: number;
  softClose: boolean;
  pushOpen: boolean;
  plateHoles?: 4 | 2;
  outOfStockOnline?: boolean;
  defaultPrice: number;
  url?: string;
}

export const HINGE_CATEGORY_ORDER = ['slide_on_4_hole', 'soft_close_clip'] as const;

export const HINGE_CATEGORY_LABELS: Record<string, string> = {
  slide_on_4_hole: 'Gelmar — slide on (4 hole plate)',
  soft_close_clip: 'Gelmar — soft close clip',
};

export const DEFAULT_HINGE_PRESET_ID = 'gelmar-200';

function decodeTitle(title: string): string {
  return title
    .replace(/&#xB0;/g, '°')
    .replace(/&#x2F;/g, '/')
    .replace(/&#x20;/g, ' ');
}

function parseOverlay(title: string): HingeOverlay {
  const t = title.toLowerCase();
  if (t.includes('zero protrusion')) return 'zero_protrusion';
  if (t.includes('blind corner')) return 'blind_corner';
  if (t.includes('bi-fold corner') || t.includes('bifold corner')) return 'bifold_corner';
  if (t.includes('inset')) return 'inset';
  if (t.includes('half overlay')) return 'half';
  if (t.includes('full overlay')) return 'full';
  return 'other';
}

function parseHingeTitle(title: string) {
  const decoded = decodeTitle(title);
  const overlay = parseOverlay(decoded);
  const angleMatch = decoded.match(/(\d{2,3})°/);
  const crankMatch = decoded.match(/°,\s*(\d+)mm/);
  const softClose = /soft close/i.test(decoded);
  const pushOpen = /push open/i.test(decoded);
  const plateHoles = /4 hole/i.test(decoded) ? (4 as const) : /2 hole/i.test(decoded) ? (2 as const) : undefined;
  return {
    decoded,
    overlay,
    angleDeg: angleMatch ? Number(angleMatch[1]) : undefined,
    crankMm: crankMatch ? Number(crankMatch[1]) : undefined,
    softClose,
    pushOpen,
    plateHoles,
  };
}

const OVERLAY_LABELS: Record<HingeOverlay, string> = {
  full: 'Full overlay',
  half: 'Half overlay',
  inset: 'Inset',
  blind_corner: 'Blind corner',
  bifold_corner: 'Bi-fold corner',
  zero_protrusion: 'Zero protrusion',
  other: 'Special',
};

function hingeShortName(parsed: ReturnType<typeof parseHingeTitle>, sku?: string, priceZar?: number | null) {
  const bits = [
    OVERLAY_LABELS[parsed.overlay],
    parsed.angleDeg ? `${parsed.angleDeg}°` : undefined,
    parsed.crankMm != null && parsed.overlay !== 'full' ? `${parsed.crankMm} mm crank` : undefined,
    parsed.softClose ? 'Soft close' : undefined,
    parsed.pushOpen ? 'Push open' : undefined,
    sku ? `SKU ${sku}` : undefined,
    priceZar != null ? `R ${priceZar.toFixed(2)}` : undefined,
  ].filter(Boolean);
  return bits.join(' · ');
}

function buildGelmarCatalog(): HingeCatalogEntry[] {
  return gelmarRaw.hinges.map((h) => {
    const parsed = parseHingeTitle(h.title);
    const id = `gelmar-${h.sku ?? h.title.replace(/\W+/g, '-').slice(0, 40)}`;
    return {
      id,
      name: parsed.decoded,
      shortName: hingeShortName(parsed, h.sku, h.priceZar),
      category: h.category,
      categoryLabel: HINGE_CATEGORY_LABELS[h.category] ?? h.categoryLabel,
      sku: h.sku,
      overlay: parsed.overlay,
      angleDeg: parsed.angleDeg,
      crankMm: parsed.crankMm,
      softClose: parsed.softClose,
      pushOpen: parsed.pushOpen,
      plateHoles: parsed.plateHoles,
      outOfStockOnline: h.outOfStockOnline,
      defaultPrice: h.priceZar ?? 0,
      url: h.url,
    };
  });
}

export const GELMAR_HINGES = buildGelmarCatalog();
export const HINGE_CATALOG: HingeCatalogEntry[] = GELMAR_HINGES;

export function getHingeById(id?: string): HingeCatalogEntry | undefined {
  if (!id) return undefined;
  return HINGE_CATALOG.find((h) => h.id === id);
}

export function getHingeGroups(): { category: string; label: string; hinges: HingeCatalogEntry[] }[] {
  const map = new Map<string, HingeCatalogEntry[]>();
  for (const h of HINGE_CATALOG) {
    const list = map.get(h.category) ?? [];
    list.push(h);
    map.set(h.category, list);
  }
  return HINGE_CATEGORY_ORDER.filter((c) => map.has(c)).map((category) => ({
    category,
    label: HINGE_CATEGORY_LABELS[category] ?? category,
    hinges: (map.get(category) ?? []).sort(
      (a, b) =>
        a.overlay.localeCompare(b.overlay) ||
        (a.angleDeg ?? 0) - (b.angleDeg ?? 0) ||
        a.defaultPrice - b.defaultPrice ||
        a.name.localeCompare(b.name),
    ),
  }));
}

export function getDefaultHingePrices(): Record<string, number> {
  const prices = Object.fromEntries(HINGE_CATALOG.map((h) => [h.id, h.defaultPrice]));
  prices.custom = 5;
  return prices;
}

export const GELMAR_HINGES_SCRAPED_AT = gelmarRaw.scrapedAt;
