import { useEffect, useMemo, useRef, useState } from 'react';
import type { Job } from '../types';
import { generateCutList } from '../lib/calculator';
import {
  formatLastBackup,
  getLastBackupIso,
  getLastCloudSyncIso,
  shouldShowBackupReminder,
} from '../lib/backupReminder';
import { formatMoney } from '../lib/currency';
import { displayGrandTotal } from './QuoteTotals';
import { createNewJob, deleteJob, duplicateJob, exportAllJobsJson, exportJobJson, importJobsJson } from '../lib/storage';

interface Props {
  jobs: Job[];
  cloudSyncState?: 'idle' | 'syncing' | 'error';
  onOpen: (id: string) => void;
  onJobsChange: (jobs: Job[]) => void;
  onSyncNow?: () => void;
}

function quoteTotal(job: Job): number | null {
  if (!job.units.some((u) => (u.unitQty ?? 0) > 0)) return null;
  try {
    const result = generateCutList(job);
    return displayGrandTotal(job.settings, result.grandTotal);
  } catch {
    return null;
  }
}

export function Dashboard({ jobs, cloudSyncState = 'idle', onOpen, onJobsChange, onSyncNow }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [lastCloudSync, setLastCloudSync] = useState(() => getLastCloudSyncIso());
  const [lastJsonBackup, setLastJsonBackup] = useState(() => getLastBackupIso());

  useEffect(() => {
    if (cloudSyncState === 'idle') {
      setLastCloudSync(getLastCloudSyncIso());
    }
  }, [cloudSyncState]);

  const handleJsonBackup = () => {
    exportAllJobsJson(jobs);
    setLastJsonBackup(getLastBackupIso());
  };

  const totals = useMemo(() => new Map(jobs.map((j) => [j.id, quoteTotal(j)])), [jobs]);

  const visibleJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...jobs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (!q) return sorted;
    return sorted.filter((j) =>
      [j.client.name, j.client.ref, j.client.address, j.client.phone].some((f) => f?.toLowerCase().includes(q)),
    );
  }, [jobs, search]);

  const handleNew = () => {
    const job = createNewJob();
    onJobsChange([job, ...jobs]);
    onOpen(job.id);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const imported = await importJobsJson(file);
      onJobsChange([...imported, ...jobs]);
      if (imported.length === 1) {
        onOpen(imported[0].id);
      } else {
        alert(`Imported ${imported.length} jobs.`);
      }
    } catch {
      alert('Could not read job file.');
    }
  };

  const handleDuplicate = (job: Job) => {
    const copy = duplicateJob(job);
    onJobsChange([copy, ...jobs]);
    onOpen(copy.id);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete job for "${name || 'Untitled'}"?`)) {
      onJobsChange(deleteJob(jobs, id));
    }
  };

  return (
    <div className="dashboard">
      <header className="page-header page-header--dashboard">
        <div>
          <h1 className="visually-hidden">Cuboards</h1>
          <p className="subtitle page-tagline">Kitchen & bedroom cupboard cut lists for installers</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
            Import
          </button>
          <input ref={fileRef} type="file" accept=".json" hidden onChange={handleImport} />
          <button type="button" className="btn btn-primary" onClick={handleNew}>
            + New job
          </button>
        </div>
      </header>

      <div className={`storage-notice${shouldShowBackupReminder(jobs.length) ? ' storage-notice-warn' : ''}`}>
        <p>
          <strong>Your jobs belong to this account only.</strong> They sync to the cloud while you&apos;re signed in —
          use the same email on another device to pick up where you left off. JSON backup below is for your own archive.
          {cloudSyncState === 'error' ? ' Cloud sync failed — try Sync to cloud now or refresh.' : null}
        </p>
        <div className="storage-notice-footer">
          <p className="hint storage-backup-meta">
            Last cloud sync: {formatLastBackup(lastCloudSync)}
            {' · '}
            JSON backup: {formatLastBackup(lastJsonBackup)}
            {shouldShowBackupReminder(jobs.length) ? ' — download a JSON backup for your archive.' : ''}
          </p>
          <div className="storage-notice-buttons">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={cloudSyncState === 'syncing' || !onSyncNow}
              onClick={() => onSyncNow?.()}
            >
              {cloudSyncState === 'syncing' ? 'Syncing…' : 'Sync to cloud now'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleJsonBackup}
              disabled={jobs.length === 0}
            >
              Back up all jobs
            </button>
          </div>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state">
          <h2>No jobs yet</h2>
          <p>Create a new job, enter cupboard sizes, and generate a cut list PDF for your cutter.</p>
          <button type="button" className="btn btn-primary" onClick={handleNew}>
            Create first job
          </button>
        </div>
      ) : (
        <>
          <input
            type="search"
            className="job-search"
            placeholder="Search by client, reference, address or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {visibleJobs.length === 0 && <p className="hint">No jobs match "{search}".</p>}
          <div className="job-grid">
            {visibleJobs.map((job) => {
              const total = totals.get(job.id);
              return (
                <article key={job.id} className="job-card">
                  <div className="job-card-body" onClick={() => onOpen(job.id)} role="button" tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onOpen(job.id)}>
                    <h3>{job.client.name || 'Untitled job'}</h3>
                    <p className="job-meta">{job.client.ref && `Ref: ${job.client.ref} · `}{job.units.length} unit{job.units.length !== 1 ? 's' : ''}</p>
                    <p className="job-total">
                      {total != null
                        ? `Quote ${formatMoney(total, job.settings, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                        : 'No units on cut list yet'}
                    </p>
                    <p className="job-date">Updated {new Date(job.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="job-card-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDuplicate(job)}>Duplicate</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => exportJobJson(job)}>Export</button>
                    <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => handleDelete(job.id, job.client.name)}>Delete</button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
