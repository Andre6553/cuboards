import gelmarRaw from '../data/gelmarScrews.json';

export interface ScrewCatalogEntry {
  id: string;
  name: string;
  shortName: string;
  sku: string;
  category: 'chipboard' | 'drywall';
  diameterMm: number;
  lengthMm: number;
  packSize: number;
  defaultPackPrice: number;
  url?: string;
}

export const SCREW_CATALOG: ScrewCatalogEntry[] = gelmarRaw.screws.map((s) => ({
  id: s.id,
  name: s.title,
  shortName: `${s.diameterMm}×${s.lengthMm} mm · pack ${s.packSize} · SKU ${s.sku}`,
  sku: s.sku,
  category: s.category as 'chipboard' | 'drywall',
  diameterMm: s.diameterMm,
  lengthMm: s.lengthMm,
  packSize: s.packSize,
  defaultPackPrice: s.priceZar,
  url: s.url,
}));

export const GELMAR_SCREWS_SCRAPED_AT = gelmarRaw.scrapedAt;

export function getScrewById(id: string): ScrewCatalogEntry | undefined {
  return SCREW_CATALOG.find((s) => s.id === id);
}

export function getDefaultScrewPrices(): Record<string, number> {
  return Object.fromEntries(SCREW_CATALOG.map((s) => [s.id, s.defaultPackPrice]));
}
