import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useCallback, useEffect, useState } from 'react';
import { AppBrandBar } from './components/AppBrandBar';
import { Dashboard } from './components/Dashboard';
import { JobEditor } from './components/JobEditor';
import type { Job } from './types';
import { catalogFingerprint, saveMaterialCatalog } from './lib/materialCatalog';
import { loadJobs, migrateJob, saveJobs, upsertJob } from './lib/storage';
import './App.css';

function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadJobs();
    saveJobs(loaded);
    setJobs(loaded);
  }, []);

  const persist = useCallback((next: Job[]) => {
    setJobs(next);
    saveJobs(next);
  }, []);

  const handleJobChange = (job: Job) => {
    const prev = jobs.find((j) => j.id === job.id);
    const catalogChanged =
      !prev ||
      catalogFingerprint(prev.materials, prev.edgingMaterials) !==
        catalogFingerprint(job.materials, job.edgingMaterials);

    if (catalogChanged) {
      const catalog = saveMaterialCatalog(job.materials, job.edgingMaterials);
      const withUpdated = upsertJob(jobs, job);
      persist(withUpdated.map((j) => migrateJob({ ...j, materials: catalog.materials.map((m) => ({ ...m })), edgingMaterials: catalog.edgingMaterials.map((e) => ({ ...e })) })));
      return;
    }

    persist(upsertJob(jobs, job));
  };

  const activeJob = jobs.find((j) => j.id === activeJobId);

  return (
    <>
      <div className="app-shell">
        <AppBrandBar
          homeEnabled={Boolean(activeJob)}
          onHome={() => setActiveJobId(null)}
          contextLabel={activeJob ? activeJob.client.name || 'Untitled job' : undefined}
        />
        <div className="app">
          {activeJob ? (
            <JobEditor
              job={activeJob}
              onChange={handleJobChange}
              onBack={() => setActiveJobId(null)}
            />
          ) : (
            <Dashboard
              jobs={jobs}
              onOpen={setActiveJobId}
              onJobsChange={persist}
            />
          )}
        </div>
      </div>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

export default App;
