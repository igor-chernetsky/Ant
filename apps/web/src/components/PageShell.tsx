import type { ReactNode } from 'react';

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="page-shell">
      <div className="page-bg-shapes" aria-hidden>
        <div className="page-bg-grid" />
        <div className="page-bg-steel-sheen" />
        <div className="page-bg-accent-glow" />
      </div>
      {children}
    </div>
  );
}
