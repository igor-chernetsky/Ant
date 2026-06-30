import { Injectable } from '@nestjs/common';
import {
  assertAreaSlug,
  assertRegionSlug,
  contractorMatchesProjectLocation,
  formatLocationLabel,
  formatProjectDistrict,
  listAreasForRegion,
  listCatalog,
  normalizeProjectLocation,
  normalizeServiceLocations,
} from './locations.util';

@Injectable()
export class LocationsService {
  listCatalog() {
    return listCatalog();
  }

  listAreasForRegion(regionSlug: string) {
    return listAreasForRegion(regionSlug);
  }

  assertRegionSlug(regionSlug: string) {
    return assertRegionSlug(regionSlug);
  }

  assertAreaSlug(regionSlug: string, areaSlug: string) {
    return assertAreaSlug(regionSlug, areaSlug);
  }

  normalizeProjectLocation(
    input: Parameters<typeof normalizeProjectLocation>[0],
  ) {
    return normalizeProjectLocation(input);
  }

  normalizeServiceLocations(raw: unknown) {
    return normalizeServiceLocations(raw);
  }

  contractorMatchesProject(
    serviceLocations: Parameters<typeof contractorMatchesProjectLocation>[0],
    project: Parameters<typeof contractorMatchesProjectLocation>[1],
  ) {
    return contractorMatchesProjectLocation(serviceLocations, project);
  }

  formatProjectDistrict(
    input: Parameters<typeof formatProjectDistrict>[0],
  ) {
    return formatProjectDistrict(input);
  }

  formatLocationLabel(regionSlug: string, areaSlug?: string | null) {
    return formatLocationLabel(regionSlug, areaSlug);
  }
}
