'use client';

import { useTranslation } from '@/components/LocaleProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';

interface TradeTagPickerProps {
  tags: Array<{
    slug: string;
    label: string;
    groupSlug: string | null;
    groupLabel: string | null;
  }>;
  selected: string[];
  onChange: (slugs: string[]) => void;
  disabled?: boolean;
}

export function TradeTagPicker({
  tags,
  selected,
  onChange,
  disabled = false,
}: TradeTagPickerProps) {
  const { t } = useTranslation();
  const { formatTagLabel, formatTagGroupLabel } = useAppFormatters();
  const groups = tags.reduce<
    Map<string, { label: string; items: typeof tags }>
  >((acc, tag) => {
    const key = tag.groupSlug ?? 'other';
    const label = formatTagGroupLabel(tag.groupSlug, tag.groupLabel);
    const group = acc.get(key) ?? { label, items: [] };
    group.items.push(tag);
    acc.set(key, group);
    return acc;
  }, new Map());

  const toggle = (slug: string) => {
    if (disabled) return;
    if (selected.includes(slug)) {
      onChange(selected.filter((item) => item !== slug));
      return;
    }
    onChange([...selected, slug]);
  };

  if (tags.length === 0) {
    return <p className="muted tag-hint">{t('tags.noTags')}</p>;
  }

  return (
    <div className="trade-tag-picker">
      {[...groups.entries()].map(([groupSlug, group]) => (
        <div key={groupSlug} className="tag-group">
          <p className="tag-group-title">{group.label}</p>
          <div className="tag-picker">
            {group.items.map((tag) => {
              const isSelected = selected.includes(tag.slug);
              return (
                <button
                  key={tag.slug}
                  type="button"
                  className={`tag-chip ${isSelected ? 'tag-chip-selected' : ''}`}
                  aria-pressed={isSelected}
                  disabled={disabled}
                  onClick={() => toggle(tag.slug)}
                >
                  {formatTagLabel(tag.slug, tag.label)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
