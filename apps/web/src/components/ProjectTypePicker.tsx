'use client';

import { useTranslation } from '@/components/LocaleProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import type { ProjectType } from '@/lib/projects';

interface ProjectTypePickerProps {
  options: Array<{ value: ProjectType; label: string }>;
  selected: ProjectType[];
  onChange: (types: ProjectType[]) => void;
  disabled?: boolean;
}

export function ProjectTypePicker({
  options,
  selected,
  onChange,
  disabled = false,
}: ProjectTypePickerProps) {
  const { t } = useTranslation();
  const { formatProjectType } = useAppFormatters();

  const toggle = (value: ProjectType) => {
    if (disabled) return;
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
      return;
    }
    onChange([...selected, value]);
  };

  if (options.length === 0) {
    return null;
  }

  return (
    <div className="trade-tag-picker project-type-picker" role="group">
      <div className="tag-picker">
        {options.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              className={`tag-chip ${isSelected ? 'tag-chip-selected' : ''}`}
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => toggle(option.value)}
            >
              {formatProjectType(option.value) || option.label}
            </button>
          );
        })}
      </div>
      <p className="muted tag-hint">
        {selected.length === 0
          ? t('contractor.projectTypesNone')
          : t('contractor.projectTypesSelected', {
              count: selected.length,
            })}
      </p>
    </div>
  );
}
