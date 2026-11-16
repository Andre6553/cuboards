import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getDeviceInstallId } from '../lib/deviceInstallId';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { parseMyAccess, type MyAccess } from '../lib/accessTypes';

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  user: User | null;
  access: MyAccess;
  passwordRecoveryPending: boolean;
  refreshAccess: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<string | null>;
  completePasswordRecovery: (password: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchAccess(): Promise<MyAccess> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('get_my_access');
  if (error) {
    console.error('get_my_access', error);
    return { authenticated: true, has_access: false, access_status: 'pending' };
  }
  return parseMyAccess(data);
}

/** getSession + SIGNED_IN + React Strict Mode all fire on one load — one in-flight RPC. */
let deviceLoginInFlight: Promise<void> | null = null;
let deviceLoginAt = 0;
const DEVICE_LOGIN_COOLDOWN_MS = 60_000;

async function recordDeviceLogin(installId: string): Promise<void> {
  const now = Date.now();
  if (deviceLoginInFlight) {
    await deviceLoginInFlight;
    return;
  }
  if (now - deviceLoginAt < DEVICE_LOGIN_COOLDOWN_MS) return;

  const supabase = getSupabase();
  deviceLoginInFlight = (async () => {
    const { error } = await supabase.rpc('record_device_login', { p_install_id: installId });
    if (error) {
      const status = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
      // 23503/409 was the missing device_installs row — ignore leftover conflicts.
      if (status !== '23503' && status !== '23505' && !/409|conflict/i.test(error.message ?? '')) {
        console.warn('record_device_login', error.message);
      }
    }
  })().finally(() => {
    deviceLoginInFlight = null;
    deviceLoginAt = Date.now();
  });
  await deviceLoginInFlight;
}

async function ensureAccessForSession(): Promise<MyAccess> {
  const supabase = getSupabase();
  const installId = getDeviceInstallId();
  let access = await fetchAccess();

  if (access.access_status === 'pending') {
    const { data, error } = await supabase.rpc('finalize_cuboards_signup', {
      p_install_id: installId,
    });
    if (!error) access = parseMyAccess(data);
  } else {
    await recordDeviceLogin(installId);
  }

  return access;
}

function authRedirectUrl(): string {
  return `${window.location.origin}${window.location.pathname}${window.location.search}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<MyAccess>({ authenticated: false });
  const [passwordRecoveryPending, setPasswordRecoveryPending] = useState(false);

  const refreshAccess = useCallback(async () => {
    if (!session) {
      setAccess({ authenticated: false });
      return;
    }
    setAccess(await ensureAccessForSession());
  }, [session]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const supabase = getSupabase();

    void supabase.auth.getSession().then(async ({ data }) => {
      const recoveryFromUrl = window.location.hash.includes('type=recovery');
      if (recoveryFromUrl && data.session) {
        setPasswordRecoveryPending(true);
        setSession(data.session);
        setLoading(false);
        return;
      }
      setSession(data.session);
      if (data.session) {
        setAccess(await ensureAccessForSession());
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecoveryPending(true);
        setSession(nextSession);
        return;
      }
      setSession(nextSession);
      if (!nextSession) {
        setAccess({ authenticated: false });
        setPasswordRecoveryPending(false);
        return;
      }
      if (event === 'SIGNED_IN') {
        void ensureAccessForSession().then(setAccess);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        return 'Confirm your email first (check inbox/spam for the Supabase link), then sign in again.';
      }
      return error.message;
    }
    if (data.session) setSession(data.session);
    setAccess(await ensureAccessForSession());
    return null;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) return error.message;
    if (!data.session) {
      return 'Check your email to confirm your account, then sign in.';
    }
    const installId = getDeviceInstallId();
    const { data: accessData, error: finErr } = await supabase.rpc('finalize_cuboards_signup', {
      p_install_id: installId,
    });
    if (finErr) return finErr.message;
    if (data.session) setSession(data.session);
    setAccess(parseMyAccess(accessData));
    return null;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    setSession(null);
    setAccess({ authenticated: false });
    setPasswordRecoveryPending(false);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const trimmed = email.trim();
    if (!trimmed) return 'Enter your email address.';
    const supabase = getSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: authRedirectUrl(),
    });
    if (error) return error.message;
    return null;
  }, []);

  const completePasswordRecovery = useCallback(async (password: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return error.message;
    setPasswordRecoveryPending(false);
    setAccess(await ensureAccessForSession());
    return null;
  }, []);

  const value = useMemo(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      access,
      passwordRecoveryPending,
      refreshAccess,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      completePasswordRecovery,
    }),
    [
      loading,
      session,
      access,
      passwordRecoveryPending,
      refreshAccess,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      completePasswordRecovery,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
