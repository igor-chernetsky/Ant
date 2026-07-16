'use client';

import { useEffect, useId, useRef, useState } from 'react';

export interface FilterMultiSelectOption {
  value: string;
  label: string;
}

interface FilterMultiSelectProps {
  label: string;
  emptyLabel: string;
  options: FilterMultiSelectOption[];
  selected: string[];
  onToggle: (value: string) => void;
}

export function FilterMultiSelect({
  label,
  emptyLabel,
  options,
  selected,
  onToggle,
}: FilterMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selectedCount = selected.length;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const triggerText = (() => {
    if (selectedCount === 0) {
      return emptyLabel;
    }
    const selectedLabels = options
      .filter((option) => selected.includes(option.value))
      .map((option) => option.label);
    if (selectedCount <= 2) {
      return selectedLabels.join(', ');
    }
    return `${selectedLabels[0]} +${selectedCount - 1}`;
  })();


  return (
    <div
      className={`project-filters-multi${open ? ' project-filters-multi--open' : ''}`}
      ref={rootRef}
    >
      <span className="project-filters-location-select-label">{label}</span>
      <button
        type="button"
        className="project-filters-multi-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className={
            selectedCount > 0
              ? 'project-filters-multi-value'
              : 'project-filters-multi-placeholder'
          }
        >
          {triggerText}
        </span>
        <span className="project-filters-multi-chevron" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <ul
          id={listboxId}
          className="project-filters-multi-menu"
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
        >
          {options.map((option) => {
            const active = selected.includes(option.value);
            return (
              <li key={option.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`project-filters-multi-option${
                    active ? ' project-filters-multi-option--active' : ''
                  }`}
                  onClick={() => onToggle(option.value)}
                >
                  <span
                    className="project-filters-multi-check"
                    aria-hidden
                  >
                    {active ? '✓' : ''}
                  </span>
                  <span>{option.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
