'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';

type AntSpinnerSize = 'sm' | 'md' | 'lg';

interface AntSpinnerProps {
  size?: AntSpinnerSize;
  /** Accessible label for screen readers. */
  label?: string;
  className?: string;
}

const SIZE_PX: Record<AntSpinnerSize, number> = {
  sm: 16,
  md: 28,
  lg: 44,
};

/**
 * Branded waiting indicator: BuilTHAI mark with an accent orbit ring.
 * Use inline in buttons (`sm`) or as a standalone status (`md`/`lg`).
 */
export function AntSpinner({
  size = 'sm',
  label = 'Loading',
  className = '',
}: AntSpinnerProps) {
  const px = SIZE_PX[size];
  return (
    <span
      className={`ant-spinner ant-spinner--${size}${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="ant-spinner-orbit" aria-hidden />
      <span className="ant-spinner-mark" aria-hidden>
        <Image
          src="/logosm.png"
          alt=""
          width={px}
          height={px}
          className="ant-spinner-logo"
          priority={size !== 'sm'}
        />
      </span>
    </span>
  );
}

interface BusyLabelProps {
  busy: boolean;
  idle: ReactNode;
  busyText: string;
  className?: string;
}

/** Button/label content that swaps to a branded spinner while busy. */
export function BusyLabel({
  busy,
  idle,
  busyText,
  className = '',
}: BusyLabelProps) {
  if (!busy) {
    return <>{idle}</>;
  }
  return (
    <span className={`busy-label${className ? ` ${className}` : ''}`}>
      <AntSpinner size="sm" label={busyText} />
      <span className="busy-label-text">{busyText}</span>
    </span>
  );
}
