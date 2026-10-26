import { CouponPanel } from './CouponPanel';
import { CuboardsLogo } from './CuboardsLogo';
import { SubscribePanel } from './SubscribePanel';
import { useAuth } from '../context/AuthContext';

export function AccessBlockedScreen() {
  const { access, signOut } = useAuth();
  const status = access.access_status;

  let title = 'Subscription required';
  let body =
    'Your subscription has ended. Renew below with PayFast to keep full access. Jobs on this device stay in your browser until you export or back them up.';

  if (status === 'expired' && access.trial_use_days_remaining === 0) {
    title = 'Free trial ended';
    body =
      'You have used all 30 trial days (one day counts each time you open Cuboards on a new calendar day). Subscribe below to keep full access.';
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <CuboardsLogo />
        </div>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-sub">{body}</p>
        {access.email ? (
          <p className="auth-meta">
            Signed in as <strong>{access.email}</strong>
          </p>
        ) : null}
        {status !== 'pending' ? (
          <>
            <CouponPanel variant="plain" />
            <SubscribePanel />
          </>
        ) : null}
        <button type="button" className="auth-submit auth-submit--secondary" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </div>
  );
}
