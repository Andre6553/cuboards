/** Live Gelmar cabinet hinge prices (category listing pages). */

import { decodeHtml, FETCH_HEADERS, sleep, todayIsoDate } from './gelmar-common.mjs';

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

function parseHingeListingPage(html) {
  const items = [];
  const blockRe = /class="product-item-info"[\s\S]*?(?=class="product-item-info"|$)/g;
  let block;
  while ((block = blockRe.exec(html))) {
    const chunk = block[0];
    const alt = chunk.match(/alt="([^"]+)"/)?.[1];
    const title = decodeHtml(alt ?? '');
    if (!title || title.includes('Ombud') || !title.toLowerCase().includes('hinge')) continue;
    const sku = chunk.match(/SKU:\s*(\d{3,5})/i)?.[1] ?? chunk.match(/SKU[^0-9]*(\d{3,5})/)?.[1];
    const price =
      chunk.match(/data-price-amount="([\d.]+)"/)?.[1] ?? chunk.match(/ZAR\s*([\d.]+)/)?.[1];
    const href = chunk.match(/href="(https:\/\/www\.gelmar\.co\.za\/[^"]+)"/)?.[1];
    items.push({
      title,
      sku,
      priceZar: price ? parseFloat(price) : null,
      url: href,
    });
  }
  return items;
}

export async function scrapeGelmarHinges() {
  const all = [];
  const errors = [];

  for (const cat of CATEGORIES) {
    for (const url of cat.urls) {
      try {
        const res = await fetch(url, {
          headers: FETCH_HEADERS,
          signal: AbortSignal.timeout(25000),
        });
        if (!res.ok) {
          errors.push(`${url} → HTTP ${res.status}`);
          continue;
        }
        const html = await res.text();
        const items = parseHingeListingPage(html);
        if (items.length === 0) {
          errors.push(`${url} → no products parsed`);
        }
        for (const item of items) {
          all.push({ ...item, category: cat.key, categoryLabel: cat.label });
        }
      } catch (err) {
        errors.push(`${url} → ${err instanceof Error ? err.message : String(err)}`);
      }
      await sleep(150);
    }
  }

  const seen = new Set();
  const unique = all.filter((x) => {
    const k = x.sku ?? x.title;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const prices = {};
  for (const h of unique) {
    if (h.sku && typeof h.priceZar === 'number' && !Number.isNaN(h.priceZar)) {
      prices[`gelmar-${h.sku}`] = h.priceZar;
    }
  }

  if (Object.keys(prices).length === 0) {
    const detail = errors.length ? errors.join('; ') : 'Gelmar returned no hinge prices';
    throw new Error(detail);
  }

  return {
    scrapedAt: todayIsoDate(),
    hinges: unique,
    prices,
    warnings: errors,
  };
}
