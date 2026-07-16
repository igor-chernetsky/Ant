export interface LocationRegion {
  slug: string;
  label: string;
  countryCode: string;
  lat: number;
  lng: number;
}

export interface LocationArea {
  slug: string;
  label: string;
  regionSlug: string;
  lat: number;
  lng: number;
}

export interface ServiceLocation {
  regionSlug: string;
  areaSlug?: string;
}

export interface LocationCatalog {
  defaultRegionSlug: string;
  regions: LocationRegion[];
  areas: LocationArea[];
}

export const DEFAULT_SERVICE_LOCATION: ServiceLocation = {
  regionSlug: 'bangkok',
};

export async function fetchLocationCatalog(): Promise<LocationCatalog> {
  const response = await fetch('/api/public/locations', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to load locations');
  }
  return response.json() as Promise<LocationCatalog>;
}

export function areasForRegion(
  catalog: LocationCatalog,
  regionSlug: string,
): LocationArea[] {
  return catalog.areas.filter((area) => area.regionSlug === regionSlug);
}

export function regionLabel(
  catalog: LocationCatalog,
  regionSlug: string,
): string {
  return (
    catalog.regions.find((region) => region.slug === regionSlug)?.label ??
    regionSlug
  );
}

export function areaLabel(
  catalog: LocationCatalog,
  areaSlug: string,
): string | undefined {
  return catalog.areas.find((area) => area.slug === areaSlug)?.label;
}

export function formatServiceLocation(
  catalog: LocationCatalog,
  location: ServiceLocation,
): string {
  const region = regionLabel(catalog, location.regionSlug);
  if (!location.areaSlug) {
    return region;
  }
  const area = areaLabel(catalog, location.areaSlug);
  return area ? `${area}, ${region}` : region;
}

export function formatProjectLocation(
  catalog: LocationCatalog,
  input: {
    locationRegionSlug: string;
    locationAreaSlug?: string | null;
    locationNote?: string | null;
    district?: string | null;
  },
): string {
  if (input.district?.trim()) {
    return input.district.trim();
  }
  const parts: string[] = [];
  if (input.locationAreaSlug) {
    const area = areaLabel(catalog, input.locationAreaSlug);
    if (area) parts.push(area);
  }
  const region = regionLabel(catalog, input.locationRegionSlug);
  if (parts.length === 0) {
    parts.push(region);
  }
  if (input.locationNote?.trim()) {
    parts.push(input.locationNote.trim());
  }
  return parts.join(' · ');
}
