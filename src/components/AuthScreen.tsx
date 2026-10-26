import { useState } from 'react';
import { CuboardsLogo } from './CuboardsLogo';
import { useAuth } from '../context/AuthContext';

type Mode = 'signin' | 'signup';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const err = mode === 'signin' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <CuboardsLogo />
        </div>
        <h1 className="auth-title">{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
        <p className="auth-sub">
          {mode === 'signup'
            ? 'Confirm your email for 30 days of use (one day per calendar day you open the app). A coupon can add more days later, once per account.'
            : 'Email and password are stored securely with Supabase Auth.'}
        </p>

        <form className="auth-form" onSubmit={onSubmit}>
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
          <label>
            Password
            <span className="auth-password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
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
          {error ? <p className="auth-error">{error}</p> : null}
          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'signin' ? (
            <>
              No account?{' '}
              <button type="button" className="auth-link" onClick={() => setMode('signup')}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" className="auth-link" onClick={() => setMode('signin')}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
