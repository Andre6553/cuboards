export type GelmarPriceChange = { id: string; label: string; oldPrice: number; newPrice: number };
export type GelmarPriceChecked = { id: string; label: string; price: number };

export type GelmarRefreshUiState = {
  note: string | null;
  error: string | null;
  changes: GelmarPriceChange[];
  checked: GelmarPriceChecked[];
  liveAt: string | null;
};

export function emptyGelmarRefreshUi(): GelmarRefreshUiState {
  return { note: null, error: null, changes: [], checked: [], liveAt: null };
}

/** Shown when live Gelmar scrape fails — site layout change, block, or API down. */
export const GELMAR_REFRESH_FAILURE_MESSAGE =
  'Could not retrieve the latest prices from gelmar.co.za. Your job still uses saved prices. ' +
  'If this keeps happening, the website may have changed — please contact the developer of Cuboards so the price checker can be updated.';

type ApiPricesResponse = {
  ok?: boolean;
  scrapedAt?: string;
  prices?: Record<string, number>;
  count?: number;
  error?: string;
  warnings?: string[];
};

export async function fetchGelmarLivePrices(
  apiPath: string,
): Promise<{ scrapedAt?: string; prices: Record<string, number> }> {
  let data: ApiPricesResponse;
  try {
    const res = await fetch(apiPath, { method: 'POST' });
    data = (await res.json()) as ApiPricesResponse;
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `Gelmar refresh failed (${res.status})`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Gelmar refresh')) throw err;
    throw new Error('network');
  }

  const priceCount = data.prices ? Object.keys(data.prices).length : 0;
  if (priceCount === 0) {
    const detail = data.warnings?.length ? data.warnings.join('; ') : data.error;
    throw new Error(detail || 'no_prices');
  }

  return { scrapedAt: data.scrapedAt, prices: data.prices! };
}

export function applyGelmarPricesToJob(
  currentPrices: Record<string, number>,
  livePrices: Record<string, number>,
  getDefault: (id: string) => number | undefined,
  formatLabel: (id: string) => string,
): { nextPrices: Record<string, number>; changes: GelmarPriceChange[]; checked: GelmarPriceChecked[] } {
  const next = { ...currentPrices };
  const changes: GelmarPriceChange[] = [];
  const checked: GelmarPriceChecked[] = [];

  for (const [id, price] of Object.entries(livePrices)) {
    if (typeof price !== 'number' || Number.isNaN(price)) continue;
    const label = formatLabel(id);
    checked.push({ id, label, price });
    const current = next[id] ?? getDefault(id) ?? 0;
    if (current !== price) {
      changes.push({ id, label, oldPrice: current, newPrice: price });
    }
    next[id] = price;
  }

  checked.sort((a, b) => a.label.localeCompare(b.label));
  return { nextPrices: next, changes, checked };
}

export function gelmarRefreshNote(changes: GelmarPriceChange[], checkedCount: number, scrapedAt?: string): string {
  const date = scrapedAt ?? 'today';
  if (changes.length === 0) {
    return `All ${checkedCount} prices match gelmar.co.za (checked ${date}). Your job already had the same numbers — nothing to change.`;
  }
  return `Updated ${changes.length} price${changes.length === 1 ? '' : 's'} from Gelmar (${date}).`;
}

export function gelmarRefreshFetchErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg === 'network' ||
    msg.includes('Failed to fetch') ||
    msg.includes('Gelmar refresh failed') ||
    msg.includes('no_prices') ||
    msg.includes('HTTP ') ||
    msg.includes('no price') ||
    msg.includes('Gelmar returned no')
  ) {
    return GELMAR_REFRESH_FAILURE_MESSAGE;
  }
  return `${GELMAR_REFRESH_FAILURE_MESSAGE} (Detail: ${msg})`;
}

export function notifyGelmarRefreshFailure(err: unknown): string {
  const message = gelmarRefreshFetchErrorMessage(err);
  if (typeof window !== 'undefined') {
    window.alert(message);
  }
  return message;
}
