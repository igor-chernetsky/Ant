'use client';

import { formatProjectStatus } from '@/lib/projects';

const STATUS_OPTIONS = [
  { value: 'in_tender', label: 'Accepting bids' },
  { value: 'estimated', label: 'Estimated' },
  { value: 'tender_ready', label: 'Tender ready' },
  { value: 'contractor_selected', label: 'Contractor selected' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
] as const;

interface StatusFilterBarProps {
  selected: string[];
  onChange: (statuses: string[]) => void;
}

export function StatusFilterBar({ selected, onChange }: StatusFilterBarProps) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((status) => status !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="tag-filter-bar status-filter-bar">
      <span className="tag-filter-label">Filter by status</span>
      <div className="tag-filter-list">
        {selected.length > 0 && (
          <button
            type="button"
            className="tag-filter-chip tag-filter-clear"
            onClick={() => onChange([])}
          >
            All statuses
          </button>
        )}
        {STATUS_OPTIONS.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              className={`tag-filter-chip${active ? ' tag-filter-chip-active' : ''}`}
              onClick={() => toggle(option.value)}
              aria-pressed={active}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {selected.length === 1 && (
        <p className="muted status-filter-hint">
          Showing: {formatProjectStatus(selected[0])}
        </p>
      )}
    </div>
  );
}
