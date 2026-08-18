'use client';

import type { ReactNode } from 'react';

interface ProductPreviewFrameProps {
  children: ReactNode;
  className?: string;
  /** Scale down on smaller viewports */
  compact?: boolean;
}

export function ProductPreviewFrame({
  children,
  className = '',
  compact = false,
}: ProductPreviewFrameProps) {
  return (
    <div
      className={`product-preview-frame${compact ? ' product-preview-frame--compact' : ''}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      <div className="product-preview-frame-window">
        <div className="product-preview-frame-toolbar">
          <span />
          <span />
          <span />
        </div>
        <div className="product-preview-frame-body pointer-events-none">
          {children}
        </div>
      </div>
    </div>
  );
}

interface PreviewCalloutProps {
  label: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export function PreviewCallout({ label, position }: PreviewCalloutProps) {
  return (
    <span className={`product-preview-callout product-preview-callout--${position}`}>
      {label}
    </span>
  );
}
