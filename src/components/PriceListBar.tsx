import { useState } from 'react';
import type { Job } from '../types';
import { applyPriceListToJob, loadPriceList, savePriceListFromJob } from '../lib/priceList';

interface Props {
  job: Job;
  onChange: (job: Job) => void;
  onPrefsSaved?: () => void;
}

export function PriceListBar({ job, onChange, onPrefsSaved }: Props) {
  const [savedAt, setSavedAt] = useState(() => loadPriceList()?.savedAt ?? null);
  const [note, setNote] = useState<string | null>(null);

  const handleSave = () => {
    if (savedAt && !confirm('Replace your saved default prices with the prices in this job?')) return;
    const list = savePriceListFromJob(job);
    setSavedAt(list.savedAt);
    onPrefsSaved?.();
    setNote(
      'Saved job settings, boards, edging, masonite, PVC kickplate, install rates, quote terms, and hardware price overrides.',
    );
  };

  const handleLoad = () => {
    const list = loadPriceList();
    if (!list) return;
    if (
      !confirm(
        'Apply your saved default prices and settings to this job? (Sheet size, foot price, boards, edging, masonite, kickplate, install rates, quote terms, hardware overrides.) Units and client stay as they are.',
      )
    ) {
      return;
    }
    onChange(applyPriceListToJob(job, list));
    setNote('Loaded your default prices into this job.');
  };

  return (
    <section className="card price-list-bar">
      <div>
        <h2>My default prices</h2>
        <p className="hint">
          {savedAt
            ? `New jobs start with the defaults you saved on ${new Date(savedAt).toLocaleString()}.`
            : 'Set your prices and job settings below, then save as defaults. New jobs start with those values. Refresh Gelmar on a job updates trade hardware without changing your saved defaults.'}
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
