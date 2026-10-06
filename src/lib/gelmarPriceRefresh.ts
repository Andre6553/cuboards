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

type ApiPricesResponse = {
  ok?: boolean;
  scrapedAt?: string;
  prices?: Record<string, number>;
  error?: string;
};

export async function fetchGelmarLivePrices(
  apiPath: string,
): Promise<{ scrapedAt?: string; prices: Record<string, number> }> {
  const res = await fetch(apiPath, { method: 'POST' });
  const data = (await res.json()) as ApiPricesResponse;
  if (!res.ok || !data.ok || !data.prices) {
    throw new Error(data.error || `Gelmar refresh failed (${res.status})`);
  }
  return { scrapedAt: data.scrapedAt, prices: data.prices };
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
  if (msg.includes('Failed to fetch')) {
    return 'Could not reach the local Cuboards server to scrape Gelmar. Keep the app running on http://localhost:5199.';
  }
  return msg;
}
