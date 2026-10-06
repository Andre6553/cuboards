import type { ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** card = standalone Materials page section; nested = inside a unit card */
  variant?: 'card' | 'nested';
}

export function CollapsibleSection({ title, children, defaultOpen, variant = 'card' }: Props) {
  const details = (
    <details className={`detail-breakdown collapsible-section${variant === 'nested' ? ' collapsible-subsection' : ''}`} open={defaultOpen}>
      <summary>{title}</summary>
      {children}
    </details>
  );

  if (variant === 'nested') {
    return <div className="unit-collapsible-block">{details}</div>;
  }

  return <section className="card">{details}</section>;
}
