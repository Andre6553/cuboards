import gelmarRaw from '../data/gelmarConnectingFittings.json';

export interface ConnectingFittingCatalogEntry {
  id: string;
  name: string;
  shortName: string;
  sku: string;
  category: string;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  packSize: number;
  defaultPackPrice: number;
  url?: string;
}

export const CONNECTING_FITTING_CATALOG: ConnectingFittingCatalogEntry[] = gelmarRaw.fittings.map((f) => ({
  id: f.id,
  name: f.title,
  shortName: `Corner block · pack ${f.packSize} · SKU ${f.sku}`,
  sku: f.sku,
  category: f.category,
  lengthMm: f.lengthMm,
  widthMm: f.widthMm,
  heightMm: f.heightMm,
  packSize: f.packSize,
  defaultPackPrice: f.priceZar,
  url: f.url,
}));

export const GELMAR_CONNECTING_FITTINGS_SCRAPED_AT = gelmarRaw.scrapedAt;

export const CONNECTING_FITTING_ID_CORNER_BLOCK = 'gelmar-5053';

export function getConnectingFittingById(id: string): ConnectingFittingCatalogEntry | undefined {
  return CONNECTING_FITTING_CATALOG.find((f) => f.id === id);
}

export function getDefaultConnectingFittingPrices(): Record<string, number> {
  return Object.fromEntries(CONNECTING_FITTING_CATALOG.map((f) => [f.id, f.defaultPackPrice]));
}
