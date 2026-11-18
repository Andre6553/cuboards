import { fetchProductPrice, todayIsoDate } from './gelmar-common.mjs';

const PRODUCT_URLS = new Map([
  ['100', 'https://www.gelmar.co.za/plinth-white-100mm-x-3m.html'],
  ['150', 'https://www.gelmar.co.za/plinth-white-150mm-x-3m.html'],
]);
const STRIP_LENGTH_METRES = 3;

export async function scrapeGelmarKickplate(requestUrl = '') {
  const height = new URLSearchParams(requestUrl.split('?')[1]).get('height') ?? '100';
  const productUrl = PRODUCT_URLS.get(height);
  if (!productUrl) throw new Error('Unsupported Gelmar kickplate height');
  const stripPrice = await fetchProductPrice(productUrl);
  if (!Number.isFinite(stripPrice) || stripPrice <= 0) {
    throw new Error('Gelmar returned no valid kickplate price');
  }
  return {
    scrapedAt: todayIsoDate(),
    prices: { pricePerMetre: Math.round((stripPrice * 100) / STRIP_LENGTH_METRES) / 100 },
  };
}
