import { useState } from 'react';
import type { Job } from '../types';
import { useAuth } from '../context/AuthContext';
import { fetchAccountPriceList, pushAccountPrefsNow } from '../lib/jobCloudSync';
import { applyPriceListToJob, loadPriceList, savePriceListFromJob } from '../lib/priceList';

interface Props {
  job: Job;
  onChange: (job: Job) => void;
  onPrefsSaved?: () => void;
}

export function PriceListBar({ job, onChange, onPrefsSaved }: Props) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [savedAt, setSavedAt] = useState(() => loadPriceList()?.savedAt ?? null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'load' | null>(null);

  const handleSave = async () => {
    if (savedAt && !confirm('Replace your saved default prices with the prices in this job?')) return;
    setBusy('save');
    setNote(null);
    try {
      const list = savePriceListFromJob(job);
      setSavedAt(list.savedAt);
      if (userId) {
        await pushAccountPrefsNow(userId);
        setNote(
          'Saved to your account (Supabase): job settings, boards, edging, masonite, PVC kickplate, install rates, quote terms, and hardware overrides. Other devices get these when you Load or Sync.',
        );
      } else {
        setNote(
          'Saved on this device only. Sign in so defaults sync to your account and other devices.',
        );
      }
      onPrefsSaved?.();
    } catch (e) {
      console.error('save default prices', e);
      setNote(
        `Saved on this device, but cloud upload failed: ${e instanceof Error ? e.message : 'unknown error'}. Try Sync now on the jobs screen.`,
      );
    } finally {
      setBusy(null);
    }
  };

  const handleLoad = async () => {
    if (
      !confirm(
        'Apply your account default prices and settings to this job? (Sheet size, foot price, boards, edging, masonite, kickplate, install rates, quote terms, hardware overrides.) Units and client stay as they are.',
      )
    ) {
      return;
    }
    setBusy('load');
    setNote(null);
    try {
      let list = null as ReturnType<typeof loadPriceList>;
      if (userId) {
        list = await fetchAccountPriceList(userId);
      }
      if (!list) list = loadPriceList();
      if (!list) {
        setNote('No default prices saved on your account yet. Save them from a job first.');
        return;
      }
      setSavedAt(list.savedAt);
      onChange(applyPriceListToJob(job, list));
      setNote(
        userId
          ? `Loaded account defaults (saved ${new Date(list.savedAt).toLocaleString()}) into this job.`
          : 'Loaded defaults from this device into this job. Sign in to pull from your account.',
      );
    } catch (e) {
      console.error('load default prices', e);
      const local = loadPriceList();
      if (local) {
        setSavedAt(local.savedAt);
        onChange(applyPriceListToJob(job, local));
        setNote(
          `Cloud pull failed (${e instanceof Error ? e.message : 'error'}); applied this device’s saved defaults instead.`,
        );
      } else {
        setNote(`Could not load defaults: ${e instanceof Error ? e.message : 'unknown error'}`);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="card price-list-bar">
      <div>
        <h2>My default prices</h2>
        <p className="hint">
          {savedAt
            ? `Account defaults last saved ${new Date(savedAt).toLocaleString()}. New jobs use these; Load pulls the latest from your account when signed in.`
            : 'Set your prices and job settings below, then save as defaults. When signed in, Save uploads them to your account so other devices match.'}
        </p>
        {note && (
          <p className={`gelmar-refresh-status ${note.includes('failed') || note.includes('Could not') ? 'err' : 'ok'}`}>
            {note}
          </p>
        )}
      </div>
      <div className="price-list-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => void handleSave()}
          disabled={busy !== null}
        >
          {busy === 'save' ? 'Saving…' : 'Save these as my default prices'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => void handleLoad()}
          disabled={busy !== null || (!savedAt && !userId)}
        >
          {busy === 'load' ? 'Loading…' : 'Load default prices into this job'}
        </button>
      </div>
    </section>
  );
}
