/** Fetch og:image from each Gelmar product page and write imageUrl onto catalog JSON. */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { FETCH_HEADERS, parseOgImageFromHtml, sleep } from './gelmar-common.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../src/data');

const files = [
  { name: 'gelmarScrews.json', listKey: 'screws' },
  { name: 'gelmarConnectingFittings.json', listKey: 'fittings' },
  { name: 'gelmarHinges.json', listKey: 'hinges' },
  { name: 'gelmarRunners.json', listKey: 'runners' },
];

async function imageUrlForProduct(url) {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseOgImageFromHtml(await res.text());
}

async function patchFile({ name, listKey }) {
  const path = join(dataDir, name);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const items = data[listKey] ?? [];
  let filled = 0;
  for (const item of items) {
    if (!item.url) continue;
    try {
      const imageUrl = await imageUrlForProduct(item.url);
      if (imageUrl) {
        item.imageUrl = imageUrl;
        filled += 1;
      }
    } catch (err) {
      console.warn(`${name} ${item.sku ?? item.id}: ${err instanceof Error ? err.message : err}`);
    }
    await sleep(120);
  }
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`${name}: ${filled}/${items.length} image URLs`);
}

for (const file of files) {
  await patchFile(file);
}