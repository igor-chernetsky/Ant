import { PROPERTY_TYPES } from '@/lib/property-types';

export const PROJECT_TRACKS = ['construction', 'design'] as const;

export type ProjectTrack = (typeof PROJECT_TRACKS)[number];

export const PROPERTY_TYPE_FILTER_SLUGS = PROPERTY_TYPES;

export type PropertyTypeFilterSlug = (typeof PROPERTY_TYPE_FILTER_SLUGS)[number];

export function projectTrackI18nKey(track: ProjectTrack): string {
  return track === 'design'
    ? 'designPermits.trackLabel'
    : 'filters.projectTrack.construction';
}

export function propertyTypeFilterI18nKey(
  slug: PropertyTypeFilterSlug,
): string {
  return `propertyType.${slug}`;
}
