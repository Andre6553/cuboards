import type { ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** card = standalone Materials page section; nested = inside a unit card */
  variant?: 'card' | 'nested';
}

export function CollapsibleSection({ title, children, defaultOpen, variant = 'card' }: Props) {
  // Uncontrolled `defaultOpen` only — do not bind `open` to props that change while typing
  // (e.g. Client details used defaultOpen={!client.name}, which collapsed on the first letter).
  const details = (
    <details
      className={`detail-breakdown collapsible-section${variant === 'nested' ? ' collapsible-subsection' : ''}`}
      {...(defaultOpen ? { defaultOpen: true } : {})}
    >
      <summary>{title}</summary>
      {children}
    </details>
  );

  if (variant === 'nested') {
    return <div className="unit-collapsible-block">{details}</div>;
  }

  return <section className="card">{details}</section>;
}
