import { CuboardsLogo } from './CuboardsLogo';

interface Props {
  onHome?: () => void;
  homeEnabled?: boolean;
  contextLabel?: string;
  accountEmail?: string;
  trialLabel?: string;
  onSignOut?: () => void;
}

export function AppBrandBar({
  onHome,
  homeEnabled = false,
  contextLabel,
  accountEmail,
  trialLabel,
  onSignOut,
}: Props) {
  const logo = <CuboardsLogo />;

  return (
    <header className={`app-brand-bar${contextLabel ? ' app-brand-bar--with-context' : ''}`}>
      <div className="app-brand-bar-inner">
        {homeEnabled && onHome ? (
          <button type="button" className="app-brand-home" onClick={onHome}>
            {logo}
            <span className="visually-hidden">Back to all jobs</span>
          </button>
        ) : (
          <div className="app-brand-home app-brand-home--static" aria-label="Cuboards">
            {logo}
          </div>
        )}
        {contextLabel ? (
          <p className="app-brand-context" title={contextLabel}>
            {contextLabel}
          </p>
        ) : null}
        <div className="app-brand-account">
          {trialLabel ? <span className="app-brand-trial">{trialLabel}</span> : null}
          {accountEmail ? (
            <span className="app-brand-email" title={accountEmail}>
              {accountEmail}
            </span>
          ) : null}
          {onSignOut ? (
            <button type="button" className="app-brand-signout" onClick={onSignOut}>
              Sign out
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
