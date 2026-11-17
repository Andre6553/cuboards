import { useState } from 'react';
import type { Job } from '../types';
import { useAuth } from '../context/AuthContext';
import { fetchAccountPriceList, pushAccountPrefsNow } from '../lib/jobCloudSync';
import { applyPriceListToJob, loadPriceList } from '../lib/priceList';

interface Props {
  job: Job;
  onChange: (job: Job) => void;
  /** Save defaults across every job + catalog; returns the updated jobs list. */
  onSaveDefaultsAcrossJobs: (sourceJob: Job) => Job[];
  onPrefsSaved?: () => void;
}

export function PriceListBar({ job, onChange, onSaveDefaultsAcrossJobs, onPrefsSaved }: Props) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [savedAt, setSavedAt] = useState(() => loadPriceList()?.savedAt ?? null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'load' | null>(null);

  const handleSave = async () => {
    const confirmMsg = savedAt
      ? 'Save as account defaults and apply to ALL jobs? Boards are never removed — missing types are added. Client and units stay. Replace your previously saved defaults?'
      : 'Save as account defaults and apply to ALL jobs? Boards are never removed — missing types are added. Client and units stay.';
    if (!confirm(confirmMsg)) return;
    setBusy('save');
    setNote(null);
    try {
      onSaveDefaultsAcrossJobs(job);
      const list = loadPriceList();
      if (list) setSavedAt(list.savedAt);
      if (userId) {
        await pushAccountPrefsNow(userId);
        setNote(
          'Saved to your account (Supabase) and applied to all jobs: settings, boards (add-only), edging, masonite, PVC kickplate, install rates, quote terms, and hardware. Other devices get these on Sync / new job.',
        );
      } else {
        setNote(
          'Saved on this device and applied to all jobs. Sign in so defaults sync to your account and other devices.',
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
            ? `Account defaults last saved ${new Date(savedAt).toLocaleString()}. Save applies to all jobs and uploads to your account; new jobs use these when signed in.`
            : 'Set your prices and job settings below, then save as defaults. Save applies to all jobs; when signed in, uploads to your account so other devices match.'}
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
