/** Live Gelmar screw pack prices (product pages from bundled catalog URLs). */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { fetchProductPrice, sleep, todayIsoDate } from './gelmar-common.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalogPath = join(__dirname, '../src/data/gelmarScrews.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));

export async function scrapeGelmarScrews() {
  const prices = {};
  const errors = [];

  for (const s of catalog.screws) {
    if (!s.url) {
      errors.push(`${s.sku ?? s.id}: missing URL`);
      continue;
    }
    try {
      const priceZar = await fetchProductPrice(s.url);
      prices[s.id] = priceZar;
    } catch (err) {
      errors.push(`${s.sku ?? s.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
    await sleep(120);
  }

  if (Object.keys(prices).length === 0) {
    const detail = errors.length ? errors.join('; ') : 'Gelmar returned no screw prices';
    throw new Error(detail);
  }

  return {
    scrapedAt: todayIsoDate(),
    prices,
    warnings: errors,
  };
}
