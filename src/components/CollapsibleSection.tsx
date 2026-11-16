import { useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** card = standalone Materials page section; nested = inside a unit card */
  variant?: 'card' | 'nested';
  /** Extra control on the summary row (e.g. enable checkbox). Clicks do not toggle open/close. */
  headerAction?: ReactNode;
}

function stopSummaryToggle(e: MouseEvent | PointerEvent) {
  e.stopPropagation();
}

export function CollapsibleSection({ title, children, defaultOpen, variant = 'card', headerAction }: Props) {
  // Initial open only from `defaultOpen` — avoid binding `open` to props that change while typing.
  const [open, setOpen] = useState(defaultOpen ?? false);
  const details = (
    <details
      className={`detail-breakdown collapsible-section${variant === 'nested' ? ' collapsible-subsection' : ''}`}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        {title}
        {headerAction != null && (
          <span className="collapsible-header-action" onClick={stopSummaryToggle} onPointerDown={stopSummaryToggle}>
            {headerAction}
          </span>
        )}
      </summary>
      {children}
    </details>
  );

  if (variant === 'nested') {
    return <div className="unit-collapsible-block">{details}</div>;
  }

  return <section className="card">{details}</section>;
}
