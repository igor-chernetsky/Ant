'use client';

import { useMemo } from 'react';
import { formatProjectStatus } from '@/lib/projects';
import {
  areaLabel,
  areasForRegion,
  regionLabel,
  type LocationCatalog,
} from '@/lib/locations';

const PRIMARY_STATUS_OPTIONS = [
  { value: 'in_tender', label: 'Accepting bids' },
  { value: 'estimated', label: 'Estimated' },
  { value: 'active', label: 'Active' },
] as const;

const SECONDARY_STATUS_OPTIONS = [
  { value: 'awarded', label: 'Awarded' },
  { value: 'completed', label: 'Completed' },
  { value: 'hidden', label: 'Hidden projects' },
] as const;

export interface HomeProjectFilterState {
  tags: string[];
  statuses: string[];
  regionSlug: string;
  areaSlug: string;
}

interface HomeProjectFiltersProps {
  tags: Array<{ slug: string; label: string }>;
  locationCatalog: LocationCatalog | null;
  filters: HomeProjectFilterState;
  onChange: (next: HomeProjectFilterState) => void;
  resultCount?: number;
  showHiddenFilter?: boolean;
}

function countActiveFilters(filters: HomeProjectFilterState): number {
  let count = 0;
  if (filters.regionSlug) count += 1;
  if (filters.areaSlug) count += 1;
  count += filters.statuses.length;
  count += filters.tags.length;
  return count;
}

export function HomeProjectFilters({
  tags,
  locationCatalog,
  filters,
  onChange,
  resultCount,
  showHiddenFilter = false,
}: HomeProjectFiltersProps) {
  const activeCount = countActiveFilters(filters);
  const hasFilters = activeCount > 0;

  const visibleSecondaryStatuses = SECONDARY_STATUS_OPTIONS.filter(
    (option) => option.value !== 'hidden' || showHiddenFilter,
  );

  const areas = useMemo(
    () =>
      locationCatalog && filters.regionSlug
        ? areasForRegion(locationCatalog, filters.regionSlug)
        : [],
    [locationCatalog, filters.regionSlug],
  );

  const advancedCount =
    filters.tags.length +
    filters.statuses.filter(
      (status) =>
        !PRIMARY_STATUS_OPTIONS.some((option) => option.value === status),
    ).length;

  const update = (patch: Partial<HomeProjectFilterState>) => {
    onChange({ ...filters, ...patch });
  };

  const toggleTag = (slug: string) => {
    const next = filters.tags.includes(slug)
      ? filters.tags.filter((value) => value !== slug)
      : [...filters.tags, slug];
    update({ tags: next });
  };

  const toggleStatus = (value: string) => {
    const next = filters.statuses.includes(value)
      ? filters.statuses.filter((status) => status !== value)
      : [...filters.statuses, value];
    update({ statuses: next });
  };

  const clearAll = () => {
    onChange({
      tags: [],
      statuses: [],
      regionSlug: '',
      areaSlug: '',
    });
  };

  const activePills: Array<{ key: string; label: string; onRemove: () => void }> =
    [];

  if (locationCatalog && filters.regionSlug) {
    const region = regionLabel(locationCatalog, filters.regionSlug);
    const area = filters.areaSlug
      ? areaLabel(locationCatalog, filters.areaSlug)
      : null;
    activePills.push({
      key: `region-${filters.regionSlug}-${filters.areaSlug}`,
      label: area ? `${area}, ${region}` : region,
      onRemove: () => update({ regionSlug: '', areaSlug: '' }),
    });
  }

  for (const status of filters.statuses) {
    activePills.push({
      key: `status-${status}`,
      label: formatProjectStatus(status),
      onRemove: () =>
        update({
          statuses: filters.statuses.filter((value) => value !== status),
        }),
    });
  }

  for (const slug of filters.tags) {
    const label = tags.find((tag) => tag.slug === slug)?.label ?? slug;
    activePills.push({
      key: `tag-${slug}`,
      label,
      onRemove: () =>
        update({ tags: filters.tags.filter((value) => value !== slug) }),
    });
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
            Clear all
            <span className="project-filters-clear-badge">{activeCount}</span>
          </button>
        )}
      </div>

      <div className="project-filters-toolbar">
        <div className="project-filters-field">
          <span className="project-filters-field-label">Location</span>
          {locationCatalog ? (
            <div className="project-filters-field-controls">
              <select
                className="project-filters-select"
                value={filters.regionSlug}
                aria-label="Region"
                onChange={(e) =>
                  update({
                    regionSlug: e.target.value,
                    areaSlug: '',
                  })
                }
              >
                <option value="">All regions</option>
                {locationCatalog.regions.map((region) => (
                  <option key={region.slug} value={region.slug}>
                    {region.label}
                  </option>
                ))}
              </select>
              <select
                className="project-filters-select"
                value={filters.areaSlug}
                aria-label="Area"
                disabled={!filters.regionSlug || areas.length === 0}
                onChange={(e) => update({ areaSlug: e.target.value })}
              >
                <option value="">All areas</option>
                {areas.map((area) => (
                  <option key={area.slug} value={area.slug}>
                    {area.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="muted project-filters-loading">Loading…</span>
          )}
        </div>

        <div className="project-filters-field project-filters-field--grow">
          <span className="project-filters-field-label">Status</span>
          <div
            className="project-filters-segmented"
            role="group"
            aria-label="Project status"
          >
            <button
              type="button"
              className={`project-filters-segment${
                filters.statuses.length === 0
                  ? ' project-filters-segment--active'
                  : ''
              }`}
              aria-pressed={filters.statuses.length === 0}
              onClick={() => update({ statuses: [] })}
            >
              All
            </button>
            {PRIMARY_STATUS_OPTIONS.map((option) => {
              const active = filters.statuses.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`project-filters-segment${
                    active ? ' project-filters-segment--active' : ''
                  }`}
                  aria-pressed={active}
                  onClick={() => toggleStatus(option.value)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {(visibleSecondaryStatuses.length > 0 || tags.length > 0) && (
        <details className="project-filters-advanced">
          <summary className="project-filters-advanced-summary">
            <span>More filters</span>
            {advancedCount > 0 && (
              <span className="project-filters-advanced-badge">
                {advancedCount}
              </span>
            )}
          </summary>
          <div className="project-filters-advanced-body">
            {visibleSecondaryStatuses.length > 0 && (
              <div className="project-filters-advanced-group">
                <p className="project-filters-group-label">Other statuses</p>
                <div className="project-filters-chips">
                  {visibleSecondaryStatuses.map((option) => {
                    const active = filters.statuses.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`filter-chip${
                          active ? ' filter-chip-active' : ''
                        }`}
                        aria-pressed={active}
                        onClick={() => toggleStatus(option.value)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {tags.length > 0 && (
              <div className="project-filters-advanced-group">
                <p className="project-filters-group-label">Trades & scope</p>
                <div className="project-filters-chips project-filters-chips-wrap">
                  {tags.map((tag) => {
                    const active = filters.tags.includes(tag.slug);
                    return (
                      <button
                        key={tag.slug}
                        type="button"
                        className={`filter-chip${
                          active ? ' filter-chip-active' : ''
                        }`}
                        aria-pressed={active}
                        onClick={() => toggleTag(tag.slug)}
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </details>
      )}

      {activePills.length > 0 && (
        <div className="project-filters-pills" aria-label="Active filters">
          {activePills.map((pill) => (
            <button
              key={pill.key}
              type="button"
              className="project-filters-pill"
              onClick={pill.onRemove}
            >
              {pill.label}
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
