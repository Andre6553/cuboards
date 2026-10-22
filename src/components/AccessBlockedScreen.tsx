import { CuboardsLogo } from './CuboardsLogo';
import { SubscribePanel } from './SubscribePanel';
import { useAuth } from '../context/AuthContext';
import { formatTrialEnds } from '../lib/accessTypes';

export function AccessBlockedScreen() {
  const { access, signOut } = useAuth();
  const status = access.access_status;

  let title = 'Subscription required';
  let body =
    'Your access has ended. Paid plans are coming soon — contact support if you need help migrating jobs from this device.';

  if (status === 'expired' && access.trial_ends_at) {
    title = 'Free trial ended';
    body = `Your 30-day trial ended on ${formatTrialEnds(access.trial_ends_at)}. Creating another account on the same browser will not start a new trial.`;
  } else if (status === 'pending') {
    title = 'Account setup incomplete';
    body = 'Sign out and sign up again, or contact support if this persists.';
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
        <SubscribePanel />
        <button type="button" className="auth-submit auth-submit--secondary" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </div>
  );
}
