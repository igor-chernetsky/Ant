import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_LOCATION_REGION_SLUG,
  DEFAULT_SERVICE_LOCATIONS,
  LOCATION_AREAS,
  LOCATION_REGIONS,
  type LocationArea,
  type LocationRegion,
  type ProjectLocation,
  type ServiceLocation,
} from './locations.catalog';

const regionBySlug = new Map(
  LOCATION_REGIONS.map((region) => [region.slug, region]),
);

const areasBySlug = new Map(
  LOCATION_AREAS.map((area) => [area.slug, area]),
);

/**
 * Catalog slugs use underscores (`chiang_mai`). Older free-text / seed data
 * sometimes used hyphens (`chiang-mai`) — map those aliases when possible.
 */
export function canonicalizeRegionSlug(slug: string): string | null {
  const trimmed = slug.trim();
  if (!trimmed) return null;
  if (regionBySlug.has(trimmed)) return trimmed;
  const underscored = trimmed.replace(/-/g, '_');
  if (underscored !== trimmed && regionBySlug.has(underscored)) {
    return underscored;
  }
  return null;
}

export function canonicalizeAreaSlug(
  regionSlug: string,
  areaSlug: string,
): string | null {
  const trimmed = areaSlug.trim();
  if (!trimmed) return null;
  const candidates = [trimmed];
  const underscored = trimmed.replace(/-/g, '_');
  if (underscored !== trimmed) candidates.push(underscored);
  for (const candidate of candidates) {
    const area = areasBySlug.get(candidate);
    if (area && area.regionSlug === regionSlug) {
      return candidate;
    }
  }
  return null;
}

export function getRegion(slug: string): LocationRegion | undefined {
  const canonical = canonicalizeRegionSlug(slug);
  return canonical ? regionBySlug.get(canonical) : undefined;
}

export function getArea(slug: string): LocationArea | undefined {
  const trimmed = slug.trim();
  if (!trimmed) return undefined;
  return (
    areasBySlug.get(trimmed) ??
    areasBySlug.get(trimmed.replace(/-/g, '_'))
  );
}

export function listAreasForRegion(regionSlug: string): LocationArea[] {
  const canonical = canonicalizeRegionSlug(regionSlug) ?? regionSlug;
  return LOCATION_AREAS.filter((area) => area.regionSlug === canonical);
}

export function assertRegionSlug(regionSlug: string): LocationRegion {
  const canonical = canonicalizeRegionSlug(regionSlug);
  if (!canonical) {
    throw new BadRequestException(`Unknown region: ${regionSlug}`);
  }
  return regionBySlug.get(canonical)!;
}

export function assertAreaSlug(
  regionSlug: string,
  areaSlug: string,
): LocationArea {
  const canonicalRegion = assertRegionSlug(regionSlug).slug;
  const canonicalArea = canonicalizeAreaSlug(canonicalRegion, areaSlug);
  if (!canonicalArea) {
    throw new BadRequestException(
      `Unknown area "${areaSlug}" for region "${regionSlug}"`,
    );
  }
  return areasBySlug.get(canonicalArea)!;
}

export function normalizeProjectLocation(input: {
  locationRegionSlug?: string | null;
  locationAreaSlug?: string | null;
  locationNote?: string | null;
}): {
  locationRegionSlug: string;
  locationAreaSlug: string | null;
  locationNote: string | null;
  regionCode: string;
  district: string | null;
} {
  const regionSlug =
    input.locationRegionSlug?.trim() || DEFAULT_LOCATION_REGION_SLUG;
  const region = assertRegionSlug(regionSlug);
  const areaSlugRaw = input.locationAreaSlug?.trim() || null;
  const areaSlug = areaSlugRaw
    ? assertAreaSlug(region.slug, areaSlugRaw).slug
    : null;
  const locationNote = input.locationNote?.trim() || null;

  return {
    locationRegionSlug: region.slug,
    locationAreaSlug: areaSlug,
    locationNote,
    regionCode: region.countryCode,
    district: formatProjectDistrict({
      regionSlug: region.slug,
      areaSlug,
      note: locationNote,
    }),
  };
}

/**
 * Strict normalize for writes (profiles, forms). Empty input → default Bangkok.
 */
export function normalizeServiceLocations(
  raw: unknown,
): ServiceLocation[] {
  if (raw == null) {
    return [...DEFAULT_SERVICE_LOCATIONS];
  }

  if (!Array.isArray(raw)) {
    throw new BadRequestException('serviceLocations must be an array');
  }

  if (raw.length === 0) {
    return [...DEFAULT_SERVICE_LOCATIONS];
  }

  const normalized: ServiceLocation[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      throw new BadRequestException('Invalid service location entry');
    }
    const regionRaw = String(
      (entry as ServiceLocation).regionSlug ?? '',
    ).trim();
    if (!regionRaw) {
      throw new BadRequestException('Each service location needs a region');
    }
    const regionSlug = assertRegionSlug(regionRaw).slug;

    const areaSlugRaw = (entry as ServiceLocation).areaSlug;
    const areaSlug =
      typeof areaSlugRaw === 'string' && areaSlugRaw.trim()
        ? assertAreaSlug(regionSlug, areaSlugRaw.trim()).slug
        : undefined;

    const key = `${regionSlug}::${areaSlug ?? '*'}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(areaSlug ? { regionSlug, areaSlug } : { regionSlug });
  }

  return normalized;
}

/**
 * Lenient read path for stored JSON (directory, matching).
 * Remaps legacy hyphen aliases; skips unknown entries; empty → [].
 */
export function coerceServiceLocations(raw: unknown): ServiceLocation[] {
  if (raw == null || !Array.isArray(raw) || raw.length === 0) {
    return [];
  }

  const normalized: ServiceLocation[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const regionRaw = String(
      (entry as ServiceLocation).regionSlug ?? '',
    ).trim();
    const regionSlug = canonicalizeRegionSlug(regionRaw);
    if (!regionSlug) continue;

    const areaSlugRaw = (entry as ServiceLocation).areaSlug;
    let areaSlug: string | undefined;
    if (typeof areaSlugRaw === 'string' && areaSlugRaw.trim()) {
      areaSlug =
        canonicalizeAreaSlug(regionSlug, areaSlugRaw.trim()) ?? undefined;
    }

    const key = `${regionSlug}::${areaSlug ?? '*'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(areaSlug ? { regionSlug, areaSlug } : { regionSlug });
  }

  return normalized;
}

export function contractorMatchesProjectLocation(
  serviceLocations: ServiceLocation[],
  project: Pick<ProjectLocation, 'regionSlug' | 'areaSlug'>,
): boolean {
  const locations =
    serviceLocations.length > 0
      ? serviceLocations
      : DEFAULT_SERVICE_LOCATIONS;

  return locations.some((location) => {
    if (location.regionSlug !== project.regionSlug) {
      return false;
    }
    if (!location.areaSlug) {
      return true;
    }
    if (!project.areaSlug) {
      return true;
    }
    return location.areaSlug === project.areaSlug;
  });
}

export function formatProjectDistrict(location: ProjectLocation): string | null {
  const parts: string[] = [];
  const area = location.areaSlug ? getArea(location.areaSlug) : undefined;
  const region = getRegion(location.regionSlug);

  if (area) {
    parts.push(area.label);
  } else if (region) {
    parts.push(region.label);
  }

  if (location.note?.trim()) {
    parts.push(location.note.trim());
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

export function formatLocationLabel(
  regionSlug: string,
  areaSlug?: string | null,
): string {
  const area = areaSlug ? getArea(areaSlug) : undefined;
  if (area) {
    return area.label;
  }
  return getRegion(regionSlug)?.label ?? regionSlug;
}

export function listCatalog() {
  return {
    defaultRegionSlug: DEFAULT_LOCATION_REGION_SLUG,
    regions: LOCATION_REGIONS,
    areas: LOCATION_AREAS,
  };
}
