export const SERVICE_FILTER_GROUPS = [
  {
    id: 'core',
    slugs: ['renovation', 'modernization'] as const,
  },
  {
    id: 'newConstruction',
    slugs: [
      'new_construction',
      'new_construction.residential',
      'new_construction.commercial',
      'new_construction.extension',
      'new_construction.industrial',
    ] as const,
  },
  {
    id: 'design',
    slugs: [
      'design',
      'design.architectural',
      'design.interior',
      'design.engineering',
      'design.permits',
    ] as const,
  },
] as const;

export const PROPERTY_OWNERSHIP_FILTER_SLUGS = [
  'employer_title',
  'leasehold',
  'developer_consent',
] as const;

export type ServiceFilterSlug =
  (typeof SERVICE_FILTER_GROUPS)[number]['slugs'][number];

export type PropertyOwnershipFilterSlug =
  (typeof PROPERTY_OWNERSHIP_FILTER_SLUGS)[number];

export function allServiceFilterSlugs(): ServiceFilterSlug[] {
  return SERVICE_FILTER_GROUPS.flatMap((group) => [...group.slugs]);
}

export function serviceFilterI18nKey(slug: ServiceFilterSlug): string {
  return `filters.service.${slug.replaceAll('.', '_')}`;
}

export function ownershipFilterI18nKey(
  slug: PropertyOwnershipFilterSlug,
): string {
  return `filters.ownership.${slug}`;
}
