import { useRef } from 'react';
import type { Job } from '../types';
import { createNewJob, deleteJob, exportJobJson, importJobJson } from '../lib/storage';

interface Props {
  jobs: Job[];
  onOpen: (id: string) => void;
  onJobsChange: (jobs: Job[]) => void;
}

export function Dashboard({ jobs, onOpen, onJobsChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleNew = () => {
    const job = createNewJob();
    onJobsChange([job, ...jobs]);
    onOpen(job.id);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const job = await importJobJson(file);
      onJobsChange([job, ...jobs]);
      onOpen(job.id);
    } catch {
      alert('Could not read job file.');
    }
    e.target.value = '';
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete job for "${name || 'Untitled'}"?`)) {
      onJobsChange(deleteJob(jobs, id));
    }
  };

  return (
    <div className="dashboard">
      <header className="page-header">
        <div>
          <h1>Cuboards</h1>
          <p className="subtitle">Kitchen & bedroom cupboard cut lists for installers</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
            Import job
          </button>
          <input ref={fileRef} type="file" accept=".json" hidden onChange={handleImport} />
          <button type="button" className="btn btn-primary" onClick={handleNew}>
            + New job
          </button>
        </div>
      </header>

      {jobs.length === 0 ? (
        <div className="empty-state">
          <h2>No jobs yet</h2>
          <p>Create a new job, enter cupboard sizes, and generate a cut list PDF for your cutter.</p>
          <button type="button" className="btn btn-primary" onClick={handleNew}>
            Create first job
          </button>
        </div>
      ) : (
        <div className="job-grid">
          {jobs.map((job) => (
            <article key={job.id} className="job-card">
              <div className="job-card-body" onClick={() => onOpen(job.id)} role="button" tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onOpen(job.id)}>
                <h3>{job.client.name || 'Untitled job'}</h3>
                <p className="job-meta">{job.client.ref && `Ref: ${job.client.ref} · `}{job.units.length} unit{job.units.length !== 1 ? 's' : ''}</p>
                <p className="job-date">Updated {new Date(job.updatedAt).toLocaleDateString()}</p>
              </div>
              <div className="job-card-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => exportJobJson(job)}>Export</button>
                <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => handleDelete(job.id, job.client.name)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
