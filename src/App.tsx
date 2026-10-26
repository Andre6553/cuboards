import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppBrandBar } from './components/AppBrandBar';
import { AccessBlockedScreen } from './components/AccessBlockedScreen';
import { AuthScreen } from './components/AuthScreen';
import { Dashboard } from './components/Dashboard';
import { JobEditor } from './components/JobEditor';
import type { Job } from './types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { formatAccessExpiryLabels } from './lib/accessTypes';
import { catalogFingerprint, saveMaterialCatalog } from './lib/materialCatalog';
import { isSupabaseConfigured } from './lib/supabaseClient';
import {
  deleteCloudJob,
  schedulePushJobs,
  schedulePushUserPrefs,
  notifyCloudSaved,
  setCloudSaveListener,
  setCloudSyncUserId,
  syncAccountWithCloud,
} from './lib/jobCloudSync';
import { setUserDataScope } from './lib/userDataScope';
import { getLastCloudSyncIso, recordCloudSync } from './lib/backupReminder';
import { migrateJob, saveJobs, upsertJob } from './lib/storage';
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
  const { access, signOut, session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [cloudSyncState, setCloudSyncState] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [lastCloudSyncIso, setLastCloudSyncIso] = useState<string | null>(() => getLastCloudSyncIso());
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  useEffect(() => {
    setCloudSaveListener(() => setLastCloudSyncIso(getLastCloudSyncIso()));
    return () => setCloudSaveListener(null);
  }, []);

  const runCloudSync = useCallback(async () => {
    if (!userId) return;
    setCloudSyncState('syncing');
    try {
      saveJobs(jobsRef.current);
      const merged = await syncAccountWithCloud(userId);
      saveJobs(merged);
      setJobs(merged);
      recordCloudSync();
      setLastCloudSyncIso(getLastCloudSyncIso());
      setCloudSyncState('idle');
    } catch (e) {
      console.error('cloud sync', e);
      setCloudSyncState('error');
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setUserDataScope(null);
      setCloudSyncUserId(null);
      setJobs([]);
      setActiveJobId(null);
      return;
    }

    setUserDataScope(userId);
    setCloudSyncUserId(userId);
    setJobs([]);
    setActiveJobId(null);
    void runCloudSync();
  }, [userId, runCloudSync]);

  const persist = useCallback(
    (next: Job[]) => {
      const prev = jobsRef.current;
      if (userId) {
        for (const p of prev) {
          if (!next.some((n) => n.id === p.id)) {
            void deleteCloudJob(userId, p.id)
              .then(() => notifyCloudSaved())
              .catch((e) => console.error('deleteCloudJob', e));
          }
        }
        schedulePushJobs(userId, next);
      }
      setJobs(next);
      saveJobs(next);
    },
    [userId],
  );

  const handleJobChange = (job: Job) => {
    const prev = jobs.find((j) => j.id === job.id);
    const catalogChanged =
      !prev ||
      catalogFingerprint(prev.materials, prev.edgingMaterials) !==
        catalogFingerprint(job.materials, job.edgingMaterials);

    if (catalogChanged) {
      const catalog = saveMaterialCatalog(job.materials, job.edgingMaterials);
      schedulePushUserPrefs();
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

  const expiryLabels = formatAccessExpiryLabels(access);

  return (
    <div className="app-shell">
      <AppBrandBar
        homeEnabled={Boolean(activeJob)}
        onHome={() => setActiveJobId(null)}
        contextLabel={activeJob ? activeJob.client.name || 'Untitled job' : undefined}
        accountEmail={access.email}
        trialLabel={expiryLabels?.full}
        trialLabelCompact={expiryLabels?.compact}
        onSignOut={() => void signOut()}
      />
      <div className="app">
        {activeJob ? (
          <JobEditor
            job={activeJob}
            onChange={handleJobChange}
            onBack={() => setActiveJobId(null)}
            onPrefsSaved={() => schedulePushUserPrefs()}
          />
        ) : (
          <Dashboard
            jobs={jobs}
            cloudSyncState={cloudSyncState}
            lastCloudSyncIso={lastCloudSyncIso}
            onOpen={setActiveJobId}
            onJobsChange={persist}
            onSyncNow={() => void runCloudSync()}
          />
        )}
      </div>
    </div>
  );
}

function AppGate() {
  const { loading, session, access, refreshAccess } = useAuth();

  useEffect(() => {
    if (!session) return;
    const params = new URLSearchParams(window.location.search);
    let fromPayfast = params.get('subscription') === 'success';
    try {
      if (sessionStorage.getItem('cuboards_payfast_return') === 'success') {
        sessionStorage.removeItem('cuboards_payfast_return');
        fromPayfast = true;
      }
    } catch {
      /* ignore */
    }
    if (fromPayfast) void refreshAccess();
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

  if (access.access_status === 'pending' && !access.has_access) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1 className="auth-title">Setting up your trial…</h1>
          <p className="auth-sub">
            We are activating your 30-day free trial. This usually takes a moment after you confirm
            your email.
          </p>
          <button type="button" className="auth-submit" onClick={() => void refreshAccess()}>
            Try again
          </button>
        </div>
      </div>
    );
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
