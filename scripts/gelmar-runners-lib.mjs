/** Shared Gelmar drawer-runner scrape (used by the export script and the Vite refresh API). */

export const GELMAR_RUNNER_CATEGORIES = [
  {
    key: 'ball_bearing',
    label: 'Ball bearing',
    urls: [
      'https://www.gelmar.co.za/runners/ball-bearing-runners.html',
      'https://www.gelmar.co.za/runners/ball-bearing-runners.html?p=2',
    ],
  },
  {
    key: 'soft_close',
    label: 'Soft close',
    urls: ['https://www.gelmar.co.za/runners.html?cat=213_soft-close-runners'],
  },
  {
    key: 'push_open',
    label: 'Push open',
    urls: ['https://www.gelmar.co.za/runners.html?cat=230_push-open-runners'],
  },
  {
    key: 'roller',
    label: 'Roller',
    urls: ['https://www.gelmar.co.za/runners.html?cat=98_roller-runners'],
  },
];

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-ZA,en;q=0.9',
};

function decodeHtml(s) {
  return s.replace(/&#x20;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
}

export function parseGelmarRunnerPage(html) {
  const items = [];
  const blockRe = /class="product-item-info"[\s\S]*?(?=class="product-item-info"|$)/g;
  let block;
  while ((block = blockRe.exec(html))) {
    const chunk = block[0];
    const alt = chunk.match(/alt="([^"]+)"/)?.[1];
    const title = decodeHtml(alt ?? '');
    if (!title || title.includes('Ombud')) continue;
    const sku = chunk.match(/SKU[^0-9]*(\d{4})/)?.[1];
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scrapeGelmarRunners() {
  const all = [];
  const errors = [];

  for (const cat of GELMAR_RUNNER_CATEGORIES) {
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
        const items = parseGelmarRunnerPage(html);
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
  for (const r of unique) {
    if (r.sku && typeof r.priceZar === 'number' && !Number.isNaN(r.priceZar)) {
      prices[`gelmar-${r.sku}`] = r.priceZar;
    }
  }

  if (Object.keys(prices).length === 0) {
    const detail = errors.length ? errors.join('; ') : 'Gelmar returned no runner prices';
    throw new Error(detail);
  }

  return {
    scrapedAt: new Date().toISOString().slice(0, 10),
    runners: unique,
    prices,
    warnings: errors,
  };
}
