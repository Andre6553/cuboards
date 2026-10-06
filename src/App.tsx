import { useCallback, useEffect, useState } from 'react';
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
  );
}

export default App;
