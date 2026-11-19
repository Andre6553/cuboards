/** Live Gelmar handle prices (handles.html pages 1–31). */

import {
  decodeHtml,
  FETCH_HEADERS,
  sleep,
  todayIsoDate,
  uncacheGelmarMediaUrl,
} from './gelmar-common.mjs';

export const GELMAR_HANDLES_PAGE_COUNT = 31;
export const GELMAR_HANDLES_BASE_URL = 'https://www.gelmar.co.za/handles.html';

/** Page 1 has no `?p=`; pages 2–31 use `?p=N`. */
export function gelmarHandlesPageUrl(page) {
  if (page <= 1) return GELMAR_HANDLES_BASE_URL;
  return `${GELMAR_HANDLES_BASE_URL}?p=${page}`;
}

export function parseHandleListingPage(html) {
  const items = [];
  const blockRe = /class="product-item-info"[\s\S]*?(?=class="product-item-info"|$)/g;
  let block;
  while ((block = blockRe.exec(html))) {
    const chunk = block[0];
    const alt = chunk.match(/alt="([^"]+)"/)?.[1];
    const title = decodeHtml(alt ?? '');
    if (!title || title.includes('Ombud')) continue;
    const sku =
      chunk.match(/SKU:\s*(\d{3,5})/i)?.[1] ?? chunk.match(/SKU[^0-9]*(\d{3,5})/)?.[1];
    const price =
      chunk.match(/data-price-amount="([\d.]+)"/)?.[1] ?? chunk.match(/ZAR\s*([\d.]+)/)?.[1];
    const href = chunk.match(/href="(https:\/\/www\.gelmar\.co\.za\/[^"]+)"/)?.[1];
    const rawImg =
      chunk.match(/data-lazysrc="(https:\/\/www\.gelmar\.co\.za\/media[^"]+)"/)?.[1] ??
      chunk.match(/src="(https:\/\/www\.gelmar\.co\.za\/media\/catalog\/product[^"]+)"/)?.[1];
    items.push({
      title,
      sku,
      priceZar: price ? parseFloat(price) : null,
      url: href,
      imageUrl: uncacheGelmarMediaUrl(rawImg ?? ''),
      outOfStockOnline: /Out Of Stock/i.test(chunk),
      category: 'handles',
      categoryLabel: 'Handles',
    });
  }
  return items;
}

async function fetchPage(page) {
  const url = gelmarHandlesPageUrl(page);
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) {
    throw new Error(`${url} → HTTP ${res.status}`);
  }
  const html = await res.text();
  const items = parseHandleListingPage(html);
  if (items.length === 0) {
    throw new Error(`${url} → no products parsed`);
  }
  return { url, items };
}

/** Scrape all handle listing pages with limited concurrency. */
export async function scrapeGelmarHandles(options = {}) {
  const pageCount = options.pageCount ?? GELMAR_HANDLES_PAGE_COUNT;
  const concurrency = Math.max(1, options.concurrency ?? 5);
  const all = [];
  const errors = [];
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

  for (let i = 0; i < pages.length; i += concurrency) {
    const batch = pages.slice(i, i + concurrency);
    const results = await Promise.allSettled(batch.map((p) => fetchPage(p)));
    for (const result of results) {
      if (result.status === 'fulfilled') {
        all.push(...result.value.items);
      } else {
        errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
      }
    }
    if (i + concurrency < pages.length) {
      await sleep(100);
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
    const detail = errors.length ? errors.join('; ') : 'Gelmar returned no handle prices';
    throw new Error(detail);
  }

  return {
    scrapedAt: todayIsoDate(),
    handles: unique,
    prices,
    warnings: errors,
  };
}
