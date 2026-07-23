'use client';

import { useMemo } from 'react';
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
  PROPERTY_OWNERSHIP_FILTER_SLUGS,
  SERVICE_FILTER_GROUPS,
  ownershipFilterI18nKey,
  serviceFilterI18nKey,
  type PropertyOwnershipFilterSlug,
  type ServiceFilterSlug,
} from '@/lib/service-filters';

// Keep order aligned with the project lifecycle presented on the product UI.
const CLIENT_WORKSPACE_STATUS_VALUES = [
  'intake',
  'ready_for_estimate',
  'estimated',
] as const;

const PRIMARY_STATUS_VALUES = ['in_tender', 'awarded', 'active'] as const;

const SECONDARY_STATUS_VALUES = ['completed', 'hidden'] as const;

export interface HomeProjectFilterState {
  tags: string[];
  statuses: string[];
  regionSlug: string;
  areaSlug: string;
  services: ServiceFilterSlug[];
  propertyOwnership: PropertyOwnershipFilterSlug[];
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
  count += filters.services.length;
  count += filters.propertyOwnership.length;
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

  const toggleService = (slug: ServiceFilterSlug) => {
    const next = filters.services.includes(slug)
      ? filters.services.filter((value) => value !== slug)
      : [...filters.services, slug];
    update({ services: next });
  };

  const toggleOwnership = (slug: PropertyOwnershipFilterSlug) => {
    const next = filters.propertyOwnership.includes(slug)
      ? filters.propertyOwnership.filter((value) => value !== slug)
      : [...filters.propertyOwnership, slug];
    update({ propertyOwnership: next });
  };

  const clearAll = () => {
    onChange({
      tags: [],
      statuses: [],
      regionSlug: '',
      areaSlug: '',
      services: [],
      propertyOwnership: [],
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

  for (const slug of filters.services) {
    activePills.push({
      key: `service-${slug}`,
      label: t(serviceFilterI18nKey(slug)),
      onRemove: () =>
        update({
          services: filters.services.filter((value) => value !== slug),
        }),
    });
  }

  for (const slug of filters.propertyOwnership) {
    activePills.push({
      key: `ownership-${slug}`,
      label: t(ownershipFilterI18nKey(slug)),
      onRemove: () =>
        update({
          propertyOwnership: filters.propertyOwnership.filter(
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

  const serviceGroupLabels = [
    t('filters.serviceType'),
    t('filters.newConstruction'),
    t('filters.design'),
  ] as const;

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
            <span className="project-filters-field-label">{t('filters.status')}</span>
            <div
              className="project-filters-segmented"
              role="group"
              aria-label={t('filters.statusAria')}
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
            {SERVICE_FILTER_GROUPS.map((group, index) => (
              <FilterMultiSelect
                key={group.id}
                label={serviceGroupLabels[index]}
                emptyLabel={t('filters.any')}
                options={group.slugs.map((slug) => ({
                  value: slug,
                  label: t(serviceFilterI18nKey(slug)),
                }))}
                selected={filters.services.filter((slug) =>
                  (group.slugs as readonly string[]).includes(slug),
                )}
                onToggle={(value) => toggleService(value as ServiceFilterSlug)}
              />
            ))}

            <FilterMultiSelect
              label={t('filters.propertyOwnership')}
              emptyLabel={t('filters.any')}
              options={PROPERTY_OWNERSHIP_FILTER_SLUGS.map((slug) => ({
                value: slug,
                label: t(ownershipFilterI18nKey(slug)),
              }))}
              selected={filters.propertyOwnership}
              onToggle={(value) =>
                toggleOwnership(value as PropertyOwnershipFilterSlug)
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
