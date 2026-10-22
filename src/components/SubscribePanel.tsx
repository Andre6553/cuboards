import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSupabase } from '../lib/supabaseClient';
import { startPayfastSubscription, subscriptionPriceLabel } from '../lib/payfastCheckout';

interface Props {
  compact?: boolean;
}

export function SubscribePanel({ compact = false }: Props) {
  const { session, refreshAccess } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onPay() {
    setError(null);
    setNotice(null);
    if (!session?.access_token) {
      setError('Sign in again to continue.');
      return;
    }
    setBusy(true);
    try {
      await startPayfastSubscription(session.access_token);
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : 'Payment could not start.');
    }
  }

  async function onRefreshAccess() {
    setNotice(null);
    setError(null);
    await refreshAccess();
    const supabase = getSupabase();
    const access = await supabase.rpc('get_my_access');
    if (access.data && typeof access.data === 'object' && (access.data as { has_access?: boolean }).has_access) {
      setNotice('Payment received — welcome back!');
      window.history.replaceState({}, '', window.location.pathname);
    } else {
      setNotice('No active subscription yet. If you just paid, wait a minute and try again.');
    }
  }

  return (
    <div className={compact ? 'subscribe-panel subscribe-panel--compact' : 'subscribe-panel'}>
      <p className="subscribe-price">
        <strong>{subscriptionPriceLabel()}</strong> — full Cuboards access (cut lists, factory PDFs, sheet maps).
      </p>
      {!compact ? (
        <p className="auth-sub">
          Pay securely on PayFast (card, instant EFT, and other options). Your account usually unlocks within a
          minute; if you&apos;re back here right after paying, tap &quot;I&apos;ve paid — refresh access&quot;.
        </p>
      ) : null}
      {error ? <p className="auth-error">{error}</p> : null}
      {notice ? <p className="subscribe-notice">{notice}</p> : null}
      <div className="subscribe-actions">
        <button type="button" className="auth-submit" disabled={busy} onClick={() => void onPay()}>
          {busy ? 'Redirecting to PayFast…' : 'Pay with PayFast'}
        </button>
        <button type="button" className="auth-submit auth-submit--secondary" onClick={() => void onRefreshAccess()}>
          I&apos;ve paid — refresh access
        </button>
      </div>
    </div>
  );
}
