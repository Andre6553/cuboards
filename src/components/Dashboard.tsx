import { useMemo, useRef, useState } from 'react';
import type { Job } from '../types';
import { generateCutList } from '../lib/calculator';
import {
  formatLastBackup,
  getLastBackupIso,
  shouldShowBackupReminder,
} from '../lib/backupReminder';
import { formatMoney } from '../lib/currency';
import { displayGrandTotal } from './QuoteTotals';
import { createNewJob, deleteJob, duplicateJob, exportAllJobsJson, exportJobJson, importJobsJson } from '../lib/storage';
import { CouponPanel } from './CouponPanel';

interface Props {
  jobs: Job[];
  cloudSyncState?: 'idle' | 'pending' | 'syncing' | 'error';
  cloudPendingCount?: number;
  lastCloudSyncIso?: string | null;
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

function cloudStatusDetail(
  state: Props['cloudSyncState'],
  pendingCount: number,
  lastCloudSyncIso: string | null,
): { label: string; detail: string } {
  switch (state) {
    case 'syncing':
      return { label: 'Saving', detail: 'Uploading your latest changes to the cloud…' };
    case 'pending':
      return {
        label: 'Pending',
        detail: `${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to sync on this device.`,
      };
    case 'error':
      return {
        label: 'Needs attention',
        detail:
          'Cloud save failed after retries. Tap Sync now — your edits stay on this device until they upload.',
      };
    default:
      if (pendingCount > 0) {
        return {
          label: 'Queued',
          detail: `${pendingCount} change${pendingCount === 1 ? '' : 's'} queued — will retry automatically.`,
        };
      }
      return {
        label: 'Up to date',
        detail: `Last saved to cloud ${formatLastBackup(lastCloudSyncIso)}.`,
      };
  }
}

export function Dashboard({
  jobs,
  cloudSyncState = 'idle',
  cloudPendingCount = 0,
  lastCloudSyncIso = null,
  onOpen,
  onJobsChange,
  onSyncNow,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [lastJsonBackup, setLastJsonBackup] = useState(() => getLastBackupIso());

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

  const syncStatus = cloudStatusDetail(cloudSyncState, cloudPendingCount, lastCloudSyncIso);
  const backupReminder = shouldShowBackupReminder(jobs.length);
  const projectCountLabel =
    jobs.length === 0
      ? 'No projects yet'
      : visibleJobs.length === jobs.length
        ? `${jobs.length} project${jobs.length === 1 ? '' : 's'}`
        : `${visibleJobs.length} of ${jobs.length} projects`;

  return (
    <div className="dashboard">
      <header className="page-header page-header--dashboard dashboard-intro">
        <div className="dashboard-intro-text">
          <h1 className="dashboard-title">My Projects</h1>
          <p className="subtitle page-tagline">Kitchen & bedroom cupboard cut lists for installers</p>
        </div>
        <div className="header-actions dashboard-header-actions">
          <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
            Import
          </button>
          <input ref={fileRef} type="file" accept=".json" hidden onChange={handleImport} />
          <button type="button" className="btn btn-primary" onClick={handleNew}>
            + New job
          </button>
        </div>
      </header>

      <CouponPanel />

      <section
        className={`dashboard-sync-panel dashboard-sync-panel--${cloudSyncState}${backupReminder ? ' dashboard-sync-panel--backup-hint' : ''}`}
        aria-label="Cloud sync and backup"
      >
        <div className="dashboard-sync-status">
          <span className={`dashboard-sync-badge dashboard-sync-badge--${cloudSyncState}`}>{syncStatus.label}</span>
          <div className="dashboard-sync-copy">
            <p className="dashboard-sync-lead">
              <strong>Cloud sync</strong>
              <span className="dashboard-sync-account"> · same sign-in on every device</span>
            </p>
            <p className="dashboard-sync-detail">{syncStatus.detail}</p>
          </div>
        </div>
        <div className="dashboard-sync-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm dashboard-sync-btn"
            disabled={cloudSyncState === 'syncing' || !onSyncNow}
            onClick={() => onSyncNow?.()}
          >
            {cloudSyncState === 'syncing' ? 'Syncing…' : 'Sync now'}
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
        <p className="dashboard-sync-meta hint">
          JSON archive last downloaded {formatLastBackup(lastJsonBackup)}
          {backupReminder ? ' · consider a JSON backup for your records.' : ''}
        </p>
      </section>

      {jobs.length === 0 ? (
        <div className="empty-state dashboard-empty">
          <h2>No jobs yet</h2>
          <p>Create a new job, enter cupboard sizes, and generate a cut list PDF for your cutter.</p>
          <button type="button" className="btn btn-primary" onClick={handleNew}>
            Create first job
          </button>
        </div>
      ) : (
        <section className="dashboard-projects" aria-labelledby="dashboard-projects-heading">
          <div className="dashboard-projects-toolbar">
            <div className="dashboard-projects-heading">
              <h2 id="dashboard-projects-heading" className="visually-hidden">
                Project list
              </h2>
              <p className="dashboard-project-count" aria-live="polite">
                {projectCountLabel}
              </p>
            </div>
            <label className="dashboard-search">
              <span className="visually-hidden">Search projects</span>
              <span className="dashboard-search-icon" aria-hidden="true">
                ⌕
              </span>
              <input
                type="search"
                className="dashboard-search-input"
                placeholder="Search client, reference, address or phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search.trim() ? (
                <button
                  type="button"
                  className="dashboard-search-clear"
                  aria-label="Clear search"
                  onClick={() => setSearch('')}
                >
                  ×
                </button>
              ) : null}
            </label>
          </div>

          {visibleJobs.length === 0 ? (
            <p className="dashboard-no-results hint">No projects match &ldquo;{search}&rdquo;.</p>
          ) : (
            <div className="job-grid">
              {visibleJobs.map((job) => {
                const total = totals.get(job.id);
                const openJob = () => onOpen(job.id);
                return (
                  <article key={job.id} className="job-card">
                    <div
                      className="job-card-body"
                      onClick={openJob}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && openJob()}
                    >
                      <div className="job-card-top">
                        <h3 className="job-card-title">{job.client.name || 'Untitled job'}</h3>
                        <span className="job-card-open" aria-hidden="true">
                          Open →
                        </span>
                      </div>
                      <div className="job-card-meta-row">
                        {job.client.ref ? <span className="job-card-ref">Ref {job.client.ref}</span> : null}
                        <span className="job-card-units">
                          {job.units.length} unit{job.units.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className={`job-card-quote${total == null ? ' job-card-quote--empty' : ''}`}>
                        <span className="job-card-quote-label">Quote total</span>
                        <span className="job-card-quote-amount">
                          {total != null
                            ? formatMoney(total, job.settings, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })
                            : 'Add units to quote'}
                        </span>
                      </div>
                      <p className="job-date">Updated {new Date(job.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <div className="job-card-actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDuplicate(job)}>
                        Duplicate
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => exportJobJson(job)}>
                        Export
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm danger"
                        onClick={() => handleDelete(job.id, job.client.name)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
