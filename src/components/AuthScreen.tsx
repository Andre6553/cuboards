import { useState } from 'react';
import { CuboardsLogo } from './CuboardsLogo';
import { useAuth } from '../context/AuthContext';

type Mode = 'signin' | 'signup' | 'forgot';

export function AuthScreen() {
  const {
    signIn,
    signUp,
    passwordRecoveryPending,
    requestPasswordReset,
    completePasswordRecovery,
  } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);

    if (passwordRecoveryPending) {
      if (password !== confirmPassword) {
        setBusy(false);
        setError('Passwords do not match.');
        return;
      }
      const err = await completePasswordRecovery(password);
      setBusy(false);
      if (err) setError(err);
      return;
    }

    if (mode === 'forgot') {
      const err = await requestPasswordReset(email);
      setBusy(false);
      if (err) {
        setError(err);
      } else {
        setInfo(
          'If an account exists for that email, we sent a reset link. Check your inbox and spam, then open the link on this device.',
        );
      }
      return;
    }

    const err = mode === 'signin' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (err) setError(err);
  }

  const recovery = passwordRecoveryPending;
  const title = recovery
    ? 'Choose a new password'
    : mode === 'signup'
      ? 'Create account'
      : mode === 'forgot'
        ? 'Reset password'
        : 'Welcome back!';

  const subtitle = recovery
    ? 'Enter a new password for your Cuboards account (at least 8 characters).'
    : mode === 'signup'
      ? 'Confirm your email for 30 days of use (one day per calendar day you open the app). A coupon can add more days later, once per account.'
      : mode === 'forgot'
        ? 'We will email you a secure link to choose a new password.'
        : 'Sign in to manage your cupboard projects.';

  return (
    <div className="auth-screen">
      <div className="auth-card auth-card--login">
        <div className="auth-card-brand">
          <div className="auth-logo auth-logo--hero">
            <CuboardsLogo />
          </div>
          <p className="auth-brand-tag">Cut-list software for cupboard installers</p>
        </div>

        {!recovery && mode !== 'forgot' ? (
          <div className="auth-trial-promo" role="note" aria-label="Free trial offer for new customers">
            <p className="auth-trial-promo__headline">NEW CUSTOMERS — ENJOY A 30-DAY FREE TRIAL!</p>
            <p className="auth-trial-promo__text">
              Try Cuboards free for 30 days and discover how easy cupboard planning and cutting lists can be.
            </p>
            <p className="auth-trial-promo__note">No payment required to start.</p>
          </div>
        ) : null}

        <h1 className="auth-title">{title}</h1>
        <p className="auth-sub">{subtitle}</p>

        <form className="auth-form" onSubmit={onSubmit}>
          {!recovery && (
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}

          {(mode === 'signin' || mode === 'signup' || recovery) && (
            <label>
              {recovery ? 'New password' : 'Password'}
              <span className="auth-password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={recovery ? 'new-password' : mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
            </label>
          )}

          {recovery && (
            <label>
              Confirm new password
              <span className="auth-password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </span>
            </label>
          )}

          {mode === 'signin' && !recovery && (
            <p className="auth-forgot-row">
              <button type="button" className="auth-link" onClick={() => switchMode('forgot')}>
                Forgot password?
              </button>
            </p>
          )}

          {error ? <p className="auth-error">{error}</p> : null}
          {info ? <p className="auth-info">{info}</p> : null}

          <button type="submit" className="auth-submit" disabled={busy}>
            {busy
              ? 'Please wait…'
              : recovery
                ? 'Update password'
                : mode === 'forgot'
                  ? 'Send reset link'
                  : mode === 'signin'
                    ? 'Sign in'
                    : 'Sign up'}
          </button>
        </form>

        {!recovery && (
          <p className="auth-switch">
            {mode === 'signin' ? (
              <>
                No account?{' '}
                <button type="button" className="auth-link" onClick={() => switchMode('signup')}>
                  Sign up
                </button>
              </>
            ) : mode === 'signup' ? (
              <>
                Already have an account?{' '}
                <button type="button" className="auth-link" onClick={() => switchMode('signin')}>
                  Sign in
                </button>
              </>
            ) : (
              <>
                Remember your password?{' '}
                <button type="button" className="auth-link" onClick={() => switchMode('signin')}>
                  Back to sign in
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
