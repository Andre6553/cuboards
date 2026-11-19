import { useEffect, useMemo, useState } from 'react';
import type { Job } from '../types';
import { formatMoney, resolveQuoteCurrency } from '../lib/currency';
import {
  getHandleCatalogForJob,
  resolveHandleUnitPrice,
  usesGelmarCatalog,
} from '../lib/hardwarePricing';
import type { HandleCatalogEntry } from '../lib/handleCatalog';

interface Props {
  job: Job;
  /** Currently selected handle id (job default or unit override). */
  selectedId?: string;
  title?: string;
  onDone: (handleId: string) => void;
  onCancel: () => void;
}

export function HandlePickerDashboard({
  job,
  selectedId,
  title = 'Choose a handle',
  onDone,
  onCancel,
}: Props) {
  const [filter, setFilter] = useState('');
  const [draftId, setDraftId] = useState(selectedId ?? '');
  const currency = resolveQuoteCurrency(job.settings);
  const fmt = (n: number) => formatMoney(n, job.settings);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onCancel]);

  const catalog = useMemo(() => getHandleCatalogForJob(job), [job]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        (h.sku ?? '').includes(q) ||
        (h.centresMm != null && String(h.centresMm).includes(q)),
    );
  }, [catalog, filter]);

  const draft = catalog.find((h) => h.id === draftId);

  const priceFor = (h: HandleCatalogEntry) =>
    resolveHandleUnitPrice(job, h.id) || h.defaultPrice;

  return (
    <div className="handle-picker-dashboard" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="handle-picker-scrim" aria-label="Close" onClick={onCancel} />
      <div className="handle-picker-panel">
        <header className="handle-picker-header">
          <div>
            <h2 className="handle-picker-title">{title}</h2>
            <p className="handle-picker-meta">
              {usesGelmarCatalog(job, 'handles')
                ? 'Gelmar handles — tap one photo, then Done.'
                : 'Your handle products — tap one, then Done.'}{' '}
              {filtered.length} shown
              {filter.trim() ? ` (of ${catalog.length})` : ''}.
            </p>
          </div>
          <div className="handle-picker-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!draftId}
              onClick={() => draftId && onDone(draftId)}
            >
              Done
            </button>
          </div>
        </header>

        <div className="handle-picker-toolbar">
          <label className="handle-picker-filter">
            <span className="sr-only">Filter handles</span>
            <input
              type="search"
              className="text-input"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by name, SKU, or mm…"
              autoFocus
            />
          </label>
          {draft && (
            <div className="handle-picker-selected-chip">
              Selected: <strong>{draft.name}</strong>
              {draft.sku ? ` · SKU ${draft.sku}` : ''} · {currency.symbol}
              {priceFor(draft).toFixed(2)}
            </div>
          )}
        </div>

        <div className="handle-picker-grid-wrap">
          {filtered.length === 0 ? (
            <p className="hint handle-picker-empty">No handles match that filter.</p>
          ) : (
            <div className="handle-picker-grid">
              {filtered.map((h) => {
                const checked = draftId === h.id;
                const price = priceFor(h);
                return (
                  <label
                    key={h.id}
                    className={`handle-picker-card${checked ? ' handle-picker-card--selected' : ''}${
                      h.outOfStockOnline ? ' handle-picker-card--oos' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="handle-picker"
                      className="handle-picker-radio"
                      checked={checked}
                      onChange={() => setDraftId(h.id)}
                    />
                    <div className="handle-picker-photo">
                      {h.imageUrl ? (
                        <img src={h.imageUrl} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <span className="handle-picker-photo-fallback">No photo</span>
                      )}
                    </div>
                    <div className="handle-picker-card-body">
                      <div className="handle-picker-card-name">{h.name}</div>
                      <div className="handle-picker-card-meta">
                        {h.sku ? `SKU ${h.sku}` : '—'}
                        {h.centresMm != null ? ` · ${h.centresMm} mm` : ''}
                        {h.outOfStockOnline ? ' · Out of stock online' : ''}
                      </div>
                      <div className="handle-picker-card-price">{fmt(price)} each</div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
