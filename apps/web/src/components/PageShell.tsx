import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/SiteFooter';

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="page-shell">
      <div className="page-bg-shapes" aria-hidden>
        <div className="page-bg-grid" />
        <div className="page-bg-steel-sheen" />
        <div className="page-bg-accent-glow" />
      </div>
      <div className="page-shell-body">{children}</div>
      <SiteFooter />
    </div>
  );
}
