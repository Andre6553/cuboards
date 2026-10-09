import type { ReactNode } from 'react';
import type { GelmarPriceChange, GelmarPriceChecked } from '../lib/gelmarPriceRefresh';

interface Props {
  snapshotScrapedAt: string;
  liveAt: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  note: string | null;
  error: string | null;
  changes: GelmarPriceChange[];
  checked: GelmarPriceChecked[];
  hint: ReactNode;
  buttonLabel?: string;
  formatPrice?: (amount: number) => string;
}

export function GelmarPriceRefreshPanel({
  snapshotScrapedAt,
  liveAt,
  refreshing,
  onRefresh,
  note,
  error,
  changes,
  checked,
  hint,
  buttonLabel = 'Refresh Gelmar prices',
  formatPrice = (n) => `R ${n.toFixed(2)}`,
}: Props) {
  return (
    <>
      <div className="gelmar-refresh-row">
        <p className="hint">
          {hint}
          {' '}
          (snapshot {snapshotScrapedAt}
          {liveAt ? `; last live check ${liveAt}` : ''}).
        </p>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={refreshing}
          onClick={() => void onRefresh()}
        >
          {refreshing ? 'Checking Gelmar…' : buttonLabel}
        </button>
      </div>
      {note && <p className="gelmar-refresh-status ok">{note}</p>}
      {changes.length > 0 && (
        <ul className="gelmar-refresh-changes">
          {changes.map((c) => (
            <li key={c.id}>
              {c.label}: {formatPrice(c.oldPrice)} → {formatPrice(c.newPrice)}
            </li>
          ))}
        </ul>
      )}
      {changes.length === 0 && checked.length > 0 && (
        <details className="gelmar-refresh-details">
          <summary>Show {checked.length} SKUs Gelmar returned (same as your job)</summary>
          <ul className="gelmar-refresh-changes">
            {checked.map((c) => (
              <li key={c.id}>
                {c.label}: {formatPrice(c.price)}
              </li>
            ))}
          </ul>
        </details>
      )}
      {error && (
        <p className="gelmar-refresh-status err" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
