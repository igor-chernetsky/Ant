import {
  Prisma,
  ProjectType,
  PropertyOwnershipForm,
  PropertyType,
} from '@prisma/client';

export const PROJECT_TRACKS = ['construction', 'design'] as const;

export type ProjectTrack = (typeof PROJECT_TRACKS)[number];

export const PROPERTY_TYPE_FILTER_SLUGS = [
  'residential',
  'commercial',
  'industrial_infrastructure',
  'public',
  'other',
] as const;

export type PropertyTypeFilterSlug =
  (typeof PROPERTY_TYPE_FILTER_SLUGS)[number];

/** `null` = all tracks (no filter). */
export function normalizeProjectTrack(
  raw?: string | null,
): ProjectTrack | null {
  const value = raw?.trim();
  if (value === 'design' || value === 'construction') {
    return value;
  }
  return null;
}

export function normalizePropertyTypeFilterSlugs(
  raw: string[],
): PropertyTypeFilterSlug[] {
  const allowed = new Set<string>(PROPERTY_TYPE_FILTER_SLUGS);
  return [...new Set(raw.map((value) => value.trim()).filter(Boolean))].filter(
    (value): value is PropertyTypeFilterSlug => allowed.has(value),
  );
}

export function buildProjectTrackFilter(
  track: ProjectTrack | null,
): Prisma.ProjectWhereInput | undefined {
  if (track === 'design') {
    return { projectType: ProjectType.design };
  }
  if (track === 'construction') {
    return { projectType: { not: ProjectType.design } };
  }
  return undefined;
}

export function buildPropertyTypeFilter(
  propertyTypeSlugs: PropertyTypeFilterSlug[],
): Prisma.ProjectWhereInput | undefined {
  if (propertyTypeSlugs.length === 0) {
    return undefined;
  }

  return {
    propertyType: {
      in: propertyTypeSlugs as PropertyType[],
    },
  };
}

export function inferPropertyOwnershipForm(
  text: string | undefined | null,
): PropertyOwnershipForm | null {
  const normalized = text?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (
    normalized.includes('lease') ||
    normalized.includes('tenant') ||
    normalized.includes('аренд') ||
    normalized.includes('เช่า')
  ) {
    return PropertyOwnershipForm.leasehold;
  }

  if (
    normalized.includes('developer') ||
    normalized.includes('consent') ||
    normalized.includes('застрой') ||
    normalized.includes('developer consent')
  ) {
    return PropertyOwnershipForm.developer_consent;
  }

  if (
    normalized.includes('title') ||
    normalized.includes('owner') ||
    normalized.includes('employer') ||
    normalized.includes('собствен') ||
    normalized.includes('титул') ||
    normalized.includes('lawful')
  ) {
    return PropertyOwnershipForm.employer_title;
  }

  return null;
}
