import { useCallback, useEffect, useState } from 'react';
import { AppBrandBar } from './components/AppBrandBar';
import { Dashboard } from './components/Dashboard';
import { JobEditor } from './components/JobEditor';
import type { Job } from './types';
import { loadJobs, saveJobs, upsertJob } from './lib/storage';
import './App.css';

function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  useEffect(() => {
    setJobs(loadJobs());
  }, []);

  const persist = useCallback((next: Job[]) => {
    setJobs(next);
    saveJobs(next);
  }, []);

  const handleJobChange = (job: Job) => {
    persist(upsertJob(jobs, job));
  };

  const activeJob = jobs.find((j) => j.id === activeJobId);

  return (
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
  );
}

export default App;
