'use client';

import { formatProjectStatus } from '@/lib/projects';

const STATUS_OPTIONS = [
  { value: 'in_tender', label: 'Accepting bids' },
  { value: 'estimated', label: 'Estimated' },
  { value: 'contractor_selected', label: 'Contractor selected' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
] as const;

interface HomeProjectFiltersProps {
  tags: Array<{ slug: string; label: string }>;
  selectedTags: string[];
  onTagsChange: (slugs: string[]) => void;
  selectedStatuses: string[];
  onStatusesChange: (statuses: string[]) => void;
  resultCount?: number;
}

export function HomeProjectFilters({
  tags,
  selectedTags,
  onTagsChange,
  selectedStatuses,
  onStatusesChange,
  resultCount,
}: HomeProjectFiltersProps) {
  const activeCount = selectedTags.length + selectedStatuses.length;
  const hasFilters = activeCount > 0;

  const toggleTag = (slug: string) => {
    if (selectedTags.includes(slug)) {
      onTagsChange(selectedTags.filter((s) => s !== slug));
    } else {
      onTagsChange([...selectedTags, slug]);
    }
  };

  const toggleStatus = (value: string) => {
    if (selectedStatuses.includes(value)) {
      onStatusesChange(selectedStatuses.filter((status) => status !== value));
    } else {
      onStatusesChange([...selectedStatuses, value]);
    }
  };

  const clearAll = () => {
    onTagsChange([]);
    onStatusesChange([]);
  };

  const summaryParts: string[] = [];
  if (selectedStatuses.length > 0) {
    summaryParts.push(
      selectedStatuses.length === 1
        ? formatProjectStatus(selectedStatuses[0])
        : `${selectedStatuses.length} statuses`,
    );
  }
  if (selectedTags.length > 0) {
    summaryParts.push(
      selectedTags.length === 1 ? '1 tag' : `${selectedTags.length} tags`,
    );
  }

  return (
    <section className="project-filters" aria-label="Project filters">
      <div className="project-filters-header">
        <div className="project-filters-heading">
          <h2 className="project-filters-title">Browse projects</h2>
          {typeof resultCount === 'number' && (
            <span className="project-filters-count muted">
              {resultCount} {resultCount === 1 ? 'project' : 'projects'}
            </span>
          )}
        </div>
        {hasFilters && (
          <button
            type="button"
            className="project-filters-clear"
            onClick={clearAll}
          >
            Clear filters
            <span className="project-filters-clear-badge">{activeCount}</span>
          </button>
        )}
      </div>

      {summaryParts.length > 0 && (
        <p className="project-filters-active muted">
          Active: {summaryParts.join(' · ')}
        </p>
      )}

      <div className="project-filters-groups">
        <div className="project-filters-group" role="group" aria-labelledby="filter-status-label">
          <p id="filter-status-label" className="project-filters-group-label">
            Status
          </p>
          <div className="project-filters-chips">
            {STATUS_OPTIONS.map((option) => {
              const active = selectedStatuses.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`filter-chip${active ? ' filter-chip-active' : ''}`}
                  onClick={() => toggleStatus(option.value)}
                  aria-pressed={active}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {tags.length > 0 && (
          <div className="project-filters-group" role="group" aria-labelledby="filter-tags-label">
            <p id="filter-tags-label" className="project-filters-group-label">
              Scope tags
            </p>
            <div className="project-filters-chips project-filters-chips-scroll">
              {tags.map((tag) => {
                const active = selectedTags.includes(tag.slug);
                return (
                  <button
                    key={tag.slug}
                    type="button"
                    className={`filter-chip${active ? ' filter-chip-active' : ''}`}
                    onClick={() => toggleTag(tag.slug)}
                    aria-pressed={active}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
