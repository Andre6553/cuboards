import { useMemo, useState } from 'react';
import type { CutListResult, Job } from '../types';
import {
  buildHardwareShoppingList,
  formatShoppingQty,
  groupShoppingBySupplier,
  hardwareShoppingGrandTotal,
  loadHardwareShoppingTicks,
  remainingShoppingItems,
  saveHardwareShoppingTicks,
  type HardwareShoppingItem,
} from '../lib/hardwareShopping';
import { formatMoney } from '../lib/currency';
import { HardwareProductThumb } from './HardwareProductThumb';

interface Props {
  job: Job;
  result: CutListResult;
}

export function HardwareShoppingView({ job, result }: Props) {
  const items = useMemo(() => buildHardwareShoppingList(job, result), [job, result]);
  const groups = useMemo(() => groupShoppingBySupplier(items), [items]);
  const grandTotal = useMemo(() => hardwareShoppingGrandTotal(items), [items]);
  const fmt = (n: number) => formatMoney(n, job.settings);
  const [ticks, setTicks] = useState<Record<string, boolean>>(() => loadHardwareShoppingTicks(job.id));
  const [reminder, setReminder] = useState<'idle' | 'done' | 'left'>('idle');

  const remaining = remainingShoppingItems(items, ticks);
  const doneCount = items.length - remaining.length;

  const setTicked = (id: string, ticked: boolean) => {
    setTicks((prev) => {
      const next = { ...prev, [id]: ticked };
      saveHardwareShoppingTicks(job.id, next);
      return next;
    });
    setReminder('idle');
  };

  const checkForgotten = () => {
    if (items.length === 0) {
      setReminder('done');
      return;
    }
    if (remaining.length === 0) {
      setReminder('done');
      return;
    }
    setReminder('left');
    const first = remaining[0];
    window.requestAnimationFrame(() => {
      document.querySelector(`[data-hw-id="${CSS.escape(first.id)}"]`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  };

  if (items.length === 0) {
    return <p className="hint">No hardware, screws, or fittings on this job yet.</p>;
  }

  return (
    <div className="hw-shop">
      <div className="hw-shop-progress" role="status">
        <strong>
          {doneCount} of {items.length} collected
        </strong>
        <span className="hint">
          Tick items as you pick them up. Stays on this phone until you clear ticks.
        </span>
        <div className="hw-shop-bar" aria-hidden>
          <div
            className="hw-shop-bar-fill"
            style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {groups.map((group) => (
        <div key={group.supplier} className="hw-shop-group">
          <h3 className="section-title">{group.supplier}</h3>
          <ul className="hw-shop-list">
            {group.items.map((item) => (
              <ShoppingRow
                key={item.id}
                item={item}
                priceLabel={fmt(item.subtotal)}
                ticked={Boolean(ticks[item.id])}
                highlight={reminder === 'left' && !ticks[item.id]}
                onToggle={(on) => setTicked(item.id, on)}
              />
            ))}
          </ul>
        </div>
      ))}

      <div className="hw-shop-grand-total" role="status">
        <span>Grand Total</span>
        <strong>{fmt(grandTotal)}</strong>
      </div>

      <div className="hw-shop-footer">
        <button type="button" className="btn btn-primary" onClick={checkForgotten}>
          Did I forget anything?
        </button>
        {reminder === 'done' && (
          <p className="hw-shop-ok" role="status">
            All items are ticked off — you have everything on this list.
          </p>
        )}
        {reminder === 'left' && remaining.length > 0 && (
          <div className="hw-shop-left" role="alert">
            <strong>Still to collect ({remaining.length})</strong>
            <ul>
              {remaining.map((item) => (
                <li key={item.id}>
                  {formatShoppingQty(item)} · {item.description}
                  {item.sku ? ` · SKU ${item.sku}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function ShoppingRow({
  item,
  priceLabel,
  ticked,
  highlight,
  onToggle,
}: {
  item: HardwareShoppingItem;
  priceLabel: string;
  ticked: boolean;
  highlight: boolean;
  onToggle: (on: boolean) => void;
}) {
  return (
    <li
      data-hw-id={item.id}
      className={`hw-shop-row${ticked ? ' is-ticked' : ''}${highlight ? ' is-left' : ''}`}
    >
      <label className="hw-shop-check">
        <input type="checkbox" checked={ticked} onChange={(e) => onToggle(e.target.checked)} />
        <HardwareProductThumb
          key={`${item.sku}-${item.imageUrl ?? ''}`}
          sku={item.sku}
          imageUrl={item.imageUrl}
          alt={item.description}
          productUrl={item.url}
        />
        <span className="hw-shop-qty">{formatShoppingQty(item)}</span>
        <span className="hw-shop-body">
          <strong>{item.description}</strong>
          <span className="hw-shop-meta">
            {item.sku ? `SKU ${item.sku}` : 'No SKU'}
            {item.notes ? ` · ${item.notes}` : ''}
          </span>
          {item.url && (
            <a className="hw-shop-link" href={item.url} target="_blank" rel="noreferrer">
              {item.url.includes('catalogsearch') ? 'Find on Gelmar' : 'Product page'}
            </a>
          )}
        </span>
        <span className="hw-shop-price">{priceLabel}</span>
      </label>
    </li>
  );
}