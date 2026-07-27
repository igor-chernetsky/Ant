'use client';

import { useMemo, type CSSProperties } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { FilterMultiSelect } from '@/components/FilterMultiSelect';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import { LocationSearchMap } from '@/components/LocationSearchMap';
import {
  areaLabel,
  areasForRegion,
  regionLabel,
  type LocationCatalog,
} from '@/lib/locations';
import {
  PROPERTY_TYPE_FILTER_SLUGS,
  PROJECT_TRACKS,
  propertyTypeFilterI18nKey,
  projectTrackI18nKey,
  type ProjectTrack,
  type PropertyTypeFilterSlug,
} from '@/lib/service-filters';

// Keep order aligned with the project lifecycle presented on the product UI.
const CLIENT_WORKSPACE_STATUS_VALUES = [
  'intake',
  'ready_for_estimate',
  'estimated',
] as const;

const PRIMARY_STATUS_VALUES = ['in_tender', 'awarded', 'active'] as const;

const SECONDARY_STATUS_VALUES = ['completed', 'hidden'] as const;

function balancedSegmentGridStyle(itemCount: number): CSSProperties {
  const columns = Math.max(2, Math.ceil(itemCount / 2));
  return { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
}

export interface HomeProjectFilterState {
  tags: string[];
  statuses: string[];
  regionSlug: string;
  areaSlug: string;
  /** `null` = all tracks. */
  projectTrack: ProjectTrack | null;
  propertyTypes: PropertyTypeFilterSlug[];
}

interface HomeProjectFiltersProps {
  tags: Array<{ slug: string; label: string }>;
  locationCatalog: LocationCatalog | null;
  filters: HomeProjectFilterState;
  onChange: (next: HomeProjectFilterState) => void;
  resultCount?: number;
  showHiddenFilter?: boolean;
  showCompletedFilter?: boolean;
  /** Show pre-tender statuses (intake / estimate) for the creating client. */
  showClientWorkspaceFilters?: boolean;
}

function countActiveFilters(filters: HomeProjectFilterState): number {
  let count = 0;
  if (filters.regionSlug) count += 1;
  if (filters.areaSlug) count += 1;
  count += filters.statuses.length;
  count += filters.tags.length;
  if (filters.projectTrack) count += 1;
  count += filters.propertyTypes.length;
  return count;
}

export function HomeProjectFilters({
  tags,
  locationCatalog,
  filters,
  onChange,
  resultCount,
  showHiddenFilter = false,
  showCompletedFilter = false,
  showClientWorkspaceFilters = false,
}: HomeProjectFiltersProps) {
  const { t } = useTranslation();
  const { formatProjectStatus } = useAppFormatters();
  const activeCount = countActiveFilters(filters);
  const hasFilters = activeCount > 0;

  const statusValues = useMemo(
    () => [
      ...(showClientWorkspaceFilters ? CLIENT_WORKSPACE_STATUS_VALUES : []),
      ...PRIMARY_STATUS_VALUES,
      ...SECONDARY_STATUS_VALUES.filter((value) => {
        if (value === 'hidden') return showHiddenFilter;
        if (value === 'completed') return showCompletedFilter;
        return true;
      }),
    ],
    [showClientWorkspaceFilters, showHiddenFilter, showCompletedFilter],
  );

  const statusButtonCount = 1 + statusValues.length;
  const statusGridStyle = useMemo(
    () => balancedSegmentGridStyle(statusButtonCount),
    [statusButtonCount],
  );

  const areas = useMemo(
    () =>
      locationCatalog && filters.regionSlug
        ? areasForRegion(locationCatalog, filters.regionSlug)
        : [],
    [locationCatalog, filters.regionSlug],
  );

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

  const togglePropertyType = (slug: PropertyTypeFilterSlug) => {
    const next = filters.propertyTypes.includes(slug)
      ? filters.propertyTypes.filter((value) => value !== slug)
      : [...filters.propertyTypes, slug];
    update({ propertyTypes: next });
  };

  const clearAll = () => {
    onChange({
      tags: [],
      statuses: [],
      regionSlug: '',
      areaSlug: '',
      projectTrack: null,
      propertyTypes: [],
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

  if (filters.projectTrack) {
    activePills.push({
      key: `track-${filters.projectTrack}`,
      label: t(projectTrackI18nKey(filters.projectTrack)),
      onRemove: () => update({ projectTrack: null }),
    });
  }

  for (const slug of filters.propertyTypes) {
    activePills.push({
      key: `property-type-${slug}`,
      label: t(propertyTypeFilterI18nKey(slug)),
      onRemove: () =>
        update({
          propertyTypes: filters.propertyTypes.filter(
            (value) => value !== slug,
          ),
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
    <section className="project-filters" aria-label={t('filters.ariaLabel')}>
      <div className="project-filters-header">
        <div className="project-filters-heading">
          <h2 className="project-filters-title">{t('filters.browseProjects')}</h2>
          {typeof resultCount === 'number' && (
            <span className="project-filters-count muted">
              {resultCount}{' '}
              {resultCount === 1 ? t('filters.project') : t('filters.projects')}
            </span>
          )}
        </div>
        {hasFilters && (
          <button
            type="button"
            className="project-filters-clear"
            onClick={clearAll}
          >
            {t('filters.clearAll')}
            <span className="project-filters-clear-badge">{activeCount}</span>
          </button>
        )}
      </div>

      <div className="project-filters-location-layout">
        <div className="project-filters-location-panel">
          <div className="project-filters-location-section">
            <span className="project-filters-field-label">{t('filters.location')}</span>
            {locationCatalog ? (
              <div className="project-filters-location-fields">
                <div className="project-filters-location-select-group">
                  <span className="project-filters-location-select-label">
                    {t('filters.region')}
                  </span>
                  <select
                    className="project-filters-select"
                    value={filters.regionSlug}
                    aria-label={t('filters.region')}
                    onChange={(e) =>
                      update({
                        regionSlug: e.target.value,
                        areaSlug: '',
                      })
                    }
                  >
                    <option value="">{t('filters.allRegions')}</option>
                    {locationCatalog.regions.map((region) => (
                      <option key={region.slug} value={region.slug}>
                        {region.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="project-filters-location-select-group">
                  <span className="project-filters-location-select-label">
                    {t('filters.area')}
                  </span>
                  <select
                    className="project-filters-select"
                    value={filters.areaSlug}
                    aria-label={t('filters.area')}
                    disabled={!filters.regionSlug || areas.length === 0}
                    onChange={(e) => update({ areaSlug: e.target.value })}
                  >
                    <option value="">{t('filters.allAreas')}</option>
                    {areas.map((area) => (
                      <option key={area.slug} value={area.slug}>
                        {area.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <span className="muted project-filters-loading">{t('common.loading')}</span>
            )}
          </div>

          <div className="project-filters-status-section">
            <span className="project-filters-field-label">
              {t('filters.projectTrackLabel')}
            </span>
            <div
              className="project-filters-segmented project-filters-segmented--track"
              role="group"
              aria-label={t('filters.projectTrackAria')}
            >
              <button
                type="button"
                className={`project-filters-segment${
                  filters.projectTrack === null
                    ? ' project-filters-segment--active'
                    : ''
                }`}
                aria-pressed={filters.projectTrack === null}
                onClick={() => update({ projectTrack: null })}
              >
                {t('filters.all')}
              </button>
              {PROJECT_TRACKS.map((track) => {
                const active = filters.projectTrack === track;
                return (
                  <button
                    key={track}
                    type="button"
                    className={`project-filters-segment${
                      active ? ' project-filters-segment--active' : ''
                    }`}
                    aria-pressed={active}
                    onClick={() => update({ projectTrack: track })}
                  >
                    {t(projectTrackI18nKey(track))}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="project-filters-status-section">
            <span className="project-filters-field-label">{t('filters.status')}</span>
            <div
              className="project-filters-segmented project-filters-segmented--balanced"
              role="group"
              aria-label={t('filters.statusAria')}
              style={statusGridStyle}
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
                {t('filters.all')}
              </button>
              {statusValues.map((value) => {
                const active = filters.statuses.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    className={`project-filters-segment${
                      active ? ' project-filters-segment--active' : ''
                    }`}
                    aria-pressed={active}
                    onClick={() => toggleStatus(value)}
                  >
                    {formatProjectStatus(value)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="project-filters-extra-grid">
            <FilterMultiSelect
              label={t('createProject.propertyTypeLabel')}
              emptyLabel={t('filters.any')}
              options={PROPERTY_TYPE_FILTER_SLUGS.map((slug) => ({
                value: slug,
                label: t(propertyTypeFilterI18nKey(slug)),
              }))}
              selected={filters.propertyTypes}
              onToggle={(value) =>
                togglePropertyType(value as PropertyTypeFilterSlug)
              }
            />

            {tags.length > 0 && (
              <FilterMultiSelect
                label={t('filters.tradesAndScope')}
                emptyLabel={t('filters.any')}
                options={tags.map((tag) => ({
                  value: tag.slug,
                  label: tag.label,
                }))}
                selected={filters.tags}
                onToggle={toggleTag}
              />
            )}
          </div>
        </div>

        {locationCatalog ? (
          <LocationSearchMap
            catalog={locationCatalog}
            regionSlug={filters.regionSlug}
            areaSlug={filters.areaSlug}
            onLocationChange={(next) =>
              update({
                regionSlug: next.regionSlug,
                areaSlug: next.areaSlug,
              })
            }
          />
        ) : null}
      </div>

      {activePills.length > 0 && (
        <div
          className="project-filters-pills"
          aria-label={t('filters.activeFiltersAria')}
        >
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
