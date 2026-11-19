import gelmarRaw from '../data/gelmarHandles.json';

export interface HandleCatalogEntry {
  id: string;
  name: string;
  shortName: string;
  category: string;
  categoryLabel: string;
  sku?: string;
  /** Hole centres / length from title when present (e.g. 96, 128). */
  centresMm?: number;
  outOfStockOnline?: boolean;
  defaultPrice: number;
  url?: string;
  imageUrl?: string;
}

export const HANDLE_CATEGORY_ORDER = ['handles'] as const;

export const HANDLE_CATEGORY_LABELS: Record<string, string> = {
  handles: 'Gelmar — handles',
};

function decodeTitle(title: string): string {
  return title
    .replace(/&#xB0;/g, '°')
    .replace(/&#x2F;/g, '/')
    .replace(/&#x20;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
}

function parseCentresMm(title: string): number | undefined {
  const m = title.match(/(\d{2,3})\s*mm\b/i);
  return m ? Number(m[1]) : undefined;
}

function handleShortName(decoded: string, sku?: string, priceZar?: number | null) {
  const bits = [
    decoded,
    sku ? `SKU ${sku}` : undefined,
    priceZar != null ? `R ${priceZar.toFixed(2)}` : undefined,
  ].filter(Boolean);
  return bits.join(' · ');
}

function buildGelmarCatalog(): HandleCatalogEntry[] {
  return gelmarRaw.handles.map((h) => {
    const decoded = decodeTitle(h.title);
    const id = `gelmar-${h.sku ?? h.title.replace(/\W+/g, '-').slice(0, 40)}`;
    return {
      id,
      name: decoded,
      shortName: handleShortName(decoded, h.sku, h.priceZar),
      category: h.category || 'handles',
      categoryLabel: HANDLE_CATEGORY_LABELS[h.category] ?? h.categoryLabel ?? 'Gelmar — handles',
      sku: h.sku,
      centresMm: parseCentresMm(decoded),
      outOfStockOnline: h.outOfStockOnline,
      defaultPrice: h.priceZar ?? 0,
      url: h.url,
      imageUrl: h.imageUrl || undefined,
    };
  });
}

export const GELMAR_HANDLES = buildGelmarCatalog();
export const HANDLE_CATALOG: HandleCatalogEntry[] = GELMAR_HANDLES;

export function getHandleById(id?: string): HandleCatalogEntry | undefined {
  if (!id) return undefined;
  return HANDLE_CATALOG.find((h) => h.id === id);
}

export function getHandleGroups(): { category: string; label: string; handles: HandleCatalogEntry[] }[] {
  const map = new Map<string, HandleCatalogEntry[]>();
  for (const h of HANDLE_CATALOG) {
    const list = map.get(h.category) ?? [];
    list.push(h);
    map.set(h.category, list);
  }
  return HANDLE_CATEGORY_ORDER.filter((c) => map.has(c)).map((category) => ({
    category,
    label: HANDLE_CATEGORY_LABELS[category] ?? category,
    handles: (map.get(category) ?? []).sort(
      (a, b) =>
        a.name.localeCompare(b.name) ||
        (a.centresMm ?? 0) - (b.centresMm ?? 0) ||
        a.defaultPrice - b.defaultPrice,
    ),
  }));
}

export function getDefaultHandlePrices(): Record<string, number> {
  const prices = Object.fromEntries(HANDLE_CATALOG.map((h) => [h.id, h.defaultPrice]));
  prices.custom = 15;
  return prices;
}

export const GELMAR_HANDLES_SCRAPED_AT = gelmarRaw.scrapedAt;
