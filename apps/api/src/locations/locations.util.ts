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

export function getRegion(slug: string): LocationRegion | undefined {
  return regionBySlug.get(slug);
}

export function getArea(slug: string): LocationArea | undefined {
  return areasBySlug.get(slug);
}

export function listAreasForRegion(regionSlug: string): LocationArea[] {
  return LOCATION_AREAS.filter((area) => area.regionSlug === regionSlug);
}

export function assertRegionSlug(regionSlug: string): LocationRegion {
  const region = getRegion(regionSlug);
  if (!region) {
    throw new BadRequestException(`Unknown region: ${regionSlug}`);
  }
  return region;
}

export function assertAreaSlug(
  regionSlug: string,
  areaSlug: string,
): LocationArea {
  const area = getArea(areaSlug);
  if (!area || area.regionSlug !== regionSlug) {
    throw new BadRequestException(
      `Unknown area "${areaSlug}" for region "${regionSlug}"`,
    );
  }
  return area;
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
  const areaSlug = input.locationAreaSlug?.trim() || null;
  if (areaSlug) {
    assertAreaSlug(regionSlug, areaSlug);
  }
  const locationNote = input.locationNote?.trim() || null;

  return {
    locationRegionSlug: regionSlug,
    locationAreaSlug: areaSlug,
    locationNote,
    regionCode: region.countryCode,
    district: formatProjectDistrict({
      regionSlug,
      areaSlug,
      note: locationNote,
    }),
  };
}

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
    const regionSlug = String(
      (entry as ServiceLocation).regionSlug ?? '',
    ).trim();
    if (!regionSlug) {
      throw new BadRequestException('Each service location needs a region');
    }
    assertRegionSlug(regionSlug);

    const areaSlugRaw = (entry as ServiceLocation).areaSlug;
    const areaSlug =
      typeof areaSlugRaw === 'string' && areaSlugRaw.trim()
        ? areaSlugRaw.trim()
        : undefined;
    if (areaSlug) {
      assertAreaSlug(regionSlug, areaSlug);
    }

    const key = `${regionSlug}::${areaSlug ?? '*'}`;
    if (seen.has(key)) {
      continue;
    }
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
