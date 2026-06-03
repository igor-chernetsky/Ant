import type { ReactNode } from 'react';

export interface MetaSpecItem {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
}

interface MetaSpecGridProps {
  items: MetaSpecItem[];
  className?: string;
}

export function MetaSpecGrid({ items, className }: MetaSpecGridProps) {
  if (items.length === 0) return null;

  const gridClass = className ? `meta-grid ${className}` : 'meta-grid';

  return (
    <dl className={gridClass}>
      {items.map((item) => (
        <div
          key={item.label}
          className={
            item.fullWidth ? 'meta-grid-item meta-grid-item-full' : 'meta-grid-item'
          }
        >
          <dt>{item.label}</dt>
          <dd>{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
