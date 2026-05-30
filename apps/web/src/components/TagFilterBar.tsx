'use client';

interface TagFilterBarProps {
  tags: Array<{ slug: string; label: string }>;
  selected: string[];
  onChange: (slugs: string[]) => void;
}

export function TagFilterBar({ tags, selected, onChange }: TagFilterBarProps) {
  const toggle = (slug: string) => {
    if (selected.includes(slug)) {
      onChange(selected.filter((s) => s !== slug));
    } else {
      onChange([...selected, slug]);
    }
  };

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="tag-filter-bar">
      <span className="tag-filter-label">Filter by tag</span>
      <div className="tag-filter-list">
        {selected.length > 0 && (
          <button
            type="button"
            className="tag-filter-chip tag-filter-clear"
            onClick={() => onChange([])}
          >
            Clear all
          </button>
        )}
        {tags.map((tag) => {
          const active = selected.includes(tag.slug);
          return (
            <button
              key={tag.slug}
              type="button"
              className={`tag-filter-chip${active ? ' tag-filter-chip-active' : ''}`}
              onClick={() => toggle(tag.slug)}
              aria-pressed={active}
            >
              {tag.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
