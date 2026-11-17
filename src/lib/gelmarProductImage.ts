/** Magento catalog files on gelmar.co.za: first two SKU chars are folder names. */
const GELMAR_MEDIA = 'https://www.gelmar.co.za/media/catalog/product';
/** Product-page cache path Gelmar uses for listing thumbs (more reliable than raw `_1` files). */
const GELMAR_MEDIA_CACHE =
  'https://www.gelmar.co.za/media/catalog/product/cache/c6dd74c09890d08f52e9961c334b9e7b';

/** Store lookup when we have a SKU but no product photo / product page. */
export function gelmarCatalogSearchUrl(sku: string): string {
  const q = sku.trim();
  if (!q) return '';
  return `https://www.gelmar.co.za/catalogsearch/result/?q=${encodeURIComponent(q)}`;
}

export function uncacheGelmarMediaUrl(url: string): string {
  return url.replace(/\/media\/catalog\/product\/cache\/[^/]+\//, '/media/catalog/product/');
}

/**
 * Magento’s missing-image logo is a small square. Real pack photos are larger.
 * Tiny `_1.jpg` placeholders (~1–2 KB) often decode around 100–265 px.
 */
export function isLikelyGelmarPlaceholderImage(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return true;
  if (width < 280 || height < 280) return true;
  return false;
}

export function gelmarProductImageCandidates(sku: string, preferredUrl?: string): string[] {
  const clean = sku.trim();
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (url: string) => {
    const next = url.trim();
    if (!next || seen.has(next)) return;
    seen.add(next);
    out.push(next);
  };
  if (preferredUrl) {
    add(preferredUrl);
    add(uncacheGelmarMediaUrl(preferredUrl));
  }
  if (clean.length >= 2) {
    const a = clean[0].toLowerCase();
    const b = clean[1].toLowerCase();
    const folder = `${a}/${b}`;
    // Pack photo is usually `{sku}.jpg`. `{sku}_1.jpg` is often Magento’s logo placeholder.
    for (const name of [`${clean}.jpg`, `${clean}_1.jpg`, `${clean}f.jpg`]) {
      add(`${GELMAR_MEDIA_CACHE}/${folder}/${name}`);
      add(`${GELMAR_MEDIA}/${folder}/${name}`);
    }
  }
  return out;
}