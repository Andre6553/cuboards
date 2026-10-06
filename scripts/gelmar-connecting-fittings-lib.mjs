/** Live Gelmar connecting fitting pack prices (product pages from bundled catalog URLs). */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { fetchProductPrice, sleep, todayIsoDate } from './gelmar-common.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalogPath = join(__dirname, '../src/data/gelmarConnectingFittings.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));

export async function scrapeGelmarConnectingFittings() {
  const prices = {};
  const errors = [];

  for (const f of catalog.fittings) {
    if (!f.url) {
      errors.push(`${f.sku ?? f.id}: missing URL`);
      continue;
    }
    try {
      const priceZar = await fetchProductPrice(f.url);
      prices[f.id] = priceZar;
    } catch (err) {
      errors.push(`${f.sku ?? f.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
    await sleep(120);
  }

  if (Object.keys(prices).length === 0) {
    const detail = errors.length ? errors.join('; ') : 'Gelmar returned no fitting prices';
    throw new Error(detail);
  }

  return {
    scrapedAt: todayIsoDate(),
    prices,
    warnings: errors,
  };
}
