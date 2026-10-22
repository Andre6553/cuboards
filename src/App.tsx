import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useCallback, useEffect, useState } from 'react';
import { AppBrandBar } from './components/AppBrandBar';
import { AccessBlockedScreen } from './components/AccessBlockedScreen';
import { AuthScreen } from './components/AuthScreen';
import { Dashboard } from './components/Dashboard';
import { JobEditor } from './components/JobEditor';
import type { Job } from './types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { formatTrialEnds } from './lib/accessTypes';
import { catalogFingerprint, saveMaterialCatalog } from './lib/materialCatalog';
import { isSupabaseConfigured } from './lib/supabaseClient';
import { loadJobs, migrateJob, saveJobs, upsertJob } from './lib/storage';
import './App.css';

function MissingSupabaseConfig() {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">Supabase not configured</h1>
        <p className="auth-sub">
          Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to{' '}
          <code>.env</code> (and Vercel env vars for production), then restart the dev server.
        </p>
      </div>
    </div>
  );
}

function CuboardsApp() {
  const { access, signOut } = useAuth();
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
      persist(
        withUpdated.map((j) =>
          migrateJob({
            ...j,
            materials: catalog.materials.map((m) => ({ ...m })),
            edgingMaterials: catalog.edgingMaterials.map((e) => ({ ...e })),
          }),
        ),
      );
      return;
    }

    persist(upsertJob(jobs, job));
  };

  const activeJob = jobs.find((j) => j.id === activeJobId);

  const trialLabel =
    access.access_status === 'trial' && access.trial_ends_at
      ? `Trial until ${formatTrialEnds(access.trial_ends_at)}`
      : undefined;

  return (
    <div className="app-shell">
      <AppBrandBar
        homeEnabled={Boolean(activeJob)}
        onHome={() => setActiveJobId(null)}
        contextLabel={activeJob ? activeJob.client.name || 'Untitled job' : undefined}
        accountEmail={access.email}
        trialLabel={trialLabel}
        onSignOut={() => void signOut()}
      />
      <div className="app">
        {activeJob ? (
          <JobEditor job={activeJob} onChange={handleJobChange} onBack={() => setActiveJobId(null)} />
        ) : (
          <Dashboard jobs={jobs} onOpen={setActiveJobId} onJobsChange={persist} />
        )}
      </div>
    </div>
  );
}

function AppGate() {
  const { loading, session, access, refreshAccess } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('subscription') === 'success' && session) {
      void refreshAccess();
    }
  }, [session, refreshAccess]);

  if (loading) {
    return (
      <div className="auth-screen">
        <p className="auth-sub">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (!access.has_access) {
    return <AccessBlockedScreen />;
  }

  return <CuboardsApp />;
}

function App() {
  if (!isSupabaseConfigured()) {
    return (
      <>
        <MissingSupabaseConfig />
        <Analytics />
        <SpeedInsights />
      </>
    );
  }

  return (
    <>
      <AuthProvider>
        <AppGate />
      </AuthProvider>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

export default App;
