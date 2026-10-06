import { useState } from 'react';
import type { Job } from '../types';
import { applyPriceListToJob, loadPriceList, savePriceListFromJob } from '../lib/priceList';

interface Props {
  job: Job;
  onChange: (job: Job) => void;
}

export function PriceListBar({ job, onChange }: Props) {
  const [savedAt, setSavedAt] = useState(() => loadPriceList()?.savedAt ?? null);
  const [note, setNote] = useState<string | null>(null);

  const handleSave = () => {
    if (savedAt && !confirm('Replace your saved default prices with the prices in this job?')) return;
    const list = savePriceListFromJob(job);
    setSavedAt(list.savedAt);
    setNote('Saved. New jobs will start with these prices and settings.');
  };

  const handleLoad = () => {
    const list = loadPriceList();
    if (!list) return;
    if (!confirm('Overwrite the prices in this job with your saved default prices? Job settings and units stay as they are.')) return;
    onChange(applyPriceListToJob(job, list));
    setNote('Loaded your default prices into this job.');
  };

  return (
    <section className="card price-list-bar">
      <div>
        <h2>My default prices</h2>
        <p className="hint">
          {savedAt
            ? `New jobs start with the prices you saved on ${new Date(savedAt).toLocaleString()}.`
            : 'New jobs start with the built-in prices. Set your prices below, then save them as your defaults so every new job starts with them.'}
        </p>
        {note && <p className="gelmar-refresh-status ok">{note}</p>}
      </div>
      <div className="price-list-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={handleSave}>
          Save these as my default prices
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleLoad} disabled={!savedAt}>
          Load default prices into this job
        </button>
      </div>
    </section>
  );
}
