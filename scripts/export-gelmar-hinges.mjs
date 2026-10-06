/** Fetch Gelmar hinge categories and write src/data/gelmarHinges.json */
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '../src/data/gelmarHinges.json');

const CATEGORIES = [
  {
    key: 'slide_on_4_hole',
    label: 'Slide on — 4 hole plate',
    urls: ['https://www.gelmar.co.za/hinges/gelmar-slide-on-4-hole.html'],
  },
  {
    key: 'soft_close_clip',
    label: 'Soft close clip',
    urls: ['https://www.gelmar.co.za/hinges.html?cat=34_gelmar-soft-close-clip'],
  },
];

function decodeHtml(s) {
  return s.replace(/&#x20;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
}

function parsePage(html) {
  const items = [];
  const blockRe = /class="product-item-info"[\s\S]*?(?=class="product-item-info"|$)/g;
  let block;
  while ((block = blockRe.exec(html))) {
    const chunk = block[0];
    const alt = chunk.match(/alt="([^"]+)"/)?.[1];
    const title = decodeHtml(alt ?? '');
    if (!title || title.includes('Ombud') || !title.toLowerCase().includes('hinge')) continue;
    const sku = chunk.match(/SKU:\s*(\d{3,5})/i)?.[1] ?? chunk.match(/SKU[^0-9]*(\d{3,5})/)?.[1];
    const price = chunk.match(/data-price-amount="([\d.]+)"/)?.[1];
    const href = chunk.match(/href="(https:\/\/www\.gelmar\.co\.za\/[^"]+)"/)?.[1];
    const outOfStock = /Out Of Stock/i.test(chunk);
    items.push({
      title,
      sku,
      priceZar: price ? parseFloat(price) : null,
      url: href,
      outOfStockOnline: outOfStock,
    });
  }
  return items;
}

const all = [];
for (const cat of CATEGORIES) {
  for (const url of cat.urls) {
    const html = await (await fetch(url)).text();
    for (const item of parsePage(html)) {
      all.push({ ...item, category: cat.key, categoryLabel: cat.label });
    }
  }
}

const seen = new Set();
const unique = all.filter((x) => {
  const k = x.sku ?? x.title;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

writeFileSync(
  outPath,
  JSON.stringify({ scrapedAt: new Date().toISOString().slice(0, 10), hinges: unique }, null, 2),
);
console.log(`Wrote ${unique.length} hinges to ${outPath}`);
