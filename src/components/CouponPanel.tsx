import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSupabase } from '../lib/supabaseClient';

interface Props {
  /** Paywall card: no outer box. Dashboard: bordered panel. */
  variant?: 'card' | 'plain';
}

export function CouponPanel({ variant = 'card' }: Props) {
  const { access, refreshAccess } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (access.coupon_code) {
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = code.trim();
    if (!trimmed) {
      setError('Enter a coupon code.');
      return;
    }
    setBusy(true);
    const { error: rpcError } = await getSupabase().rpc('redeem_cuboards_coupon', {
      p_code: trimmed,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message || 'Could not apply that coupon.');
      return;
    }
    setCode('');
    await refreshAccess();
  }

  return (
    <div className={variant === 'plain' ? 'coupon-panel coupon-panel--plain' : 'coupon-panel'}>
      <p className="coupon-hint">
        Have a coupon? Enter your code below to add extra days on top of the access you already have. One coupon
        per account.
      </p>
      <form className="coupon-form" onSubmit={(e) => void onSubmit(e)}>
        <input
          type="text"
          name="coupon"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="Coupon code"
          aria-label="Coupon code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={busy}
        />
        <button type="submit" className="auth-submit" disabled={busy}>
          {busy ? 'Applying…' : 'Apply'}
        </button>
      </form>
      {error ? <p className="auth-error">{error}</p> : null}
    </div>
  );
}
