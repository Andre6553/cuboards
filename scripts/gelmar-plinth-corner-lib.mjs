import { fetchProductPrice, todayIsoDate } from './gelmar-common.mjs';

const PRODUCT_URLS = new Map([
  ['100', 'https://www.gelmar.co.za/plinth-corner-flexible-aluminium-100mm.html'],
  ['150', 'https://www.gelmar.co.za/plinth-corner-flexible-aluminium-150mm.html'],
]);

export async function scrapeGelmarPlinthCorner(requestUrl = '') {
  const height = new URLSearchParams(requestUrl.split('?')[1]).get('height') ?? '100';
  const productUrl = PRODUCT_URLS.get(height);
  if (!productUrl) throw new Error('Unsupported Gelmar plinth corner height');
  const priceEach = await fetchProductPrice(productUrl);
  if (!Number.isFinite(priceEach) || priceEach <= 0) {
    throw new Error('Gelmar returned no valid plinth corner price');
  }
  return {
    scrapedAt: todayIsoDate(),
    prices: { priceEach: Math.round(priceEach * 100) / 100 },
  };
}
