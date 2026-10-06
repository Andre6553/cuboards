/** Shared Gelmar fetch + HTML price parsing for live refresh APIs. */

export const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-ZA,en;q=0.9',
};

export function decodeHtml(s) {
  return s.replace(/&#x20;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
}

export function parsePriceFromHtml(html) {
  const raw =
    html.match(/data-price-amount="([\d.]+)"/)?.[1] ??
    html.match(/itemprop="price"\s+content="([\d.]+)"/)?.[1] ??
    html.match(/ZAR\s*([\d.]+)/)?.[1];
  if (!raw) return null;
  const n = parseFloat(raw);
  return Number.isNaN(n) ? null : n;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchProductPrice(url) {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const html = await res.text();
  const price = parsePriceFromHtml(html);
  if (price == null) {
    throw new Error('no price on page');
  }
  return price;
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}
