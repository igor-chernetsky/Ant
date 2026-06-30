export const DEFAULT_LOCATION_REGION_SLUG = 'bangkok';

export interface LocationRegion {
  slug: string;
  label: string;
  countryCode: string;
}

export interface LocationArea {
  slug: string;
  label: string;
  regionSlug: string;
}

export interface ServiceLocation {
  regionSlug: string;
  areaSlug?: string;
}

export interface ProjectLocation {
  regionSlug: string;
  areaSlug?: string | null;
  note?: string | null;
}

export const LOCATION_REGIONS: LocationRegion[] = [
  { slug: 'bangkok', label: 'Bangkok', countryCode: 'TH' },
  { slug: 'phuket', label: 'Phuket', countryCode: 'TH' },
  { slug: 'chiang_mai', label: 'Chiang Mai', countryCode: 'TH' },
  { slug: 'pattaya', label: 'Pattaya / Chonburi', countryCode: 'TH' },
  { slug: 'hua_hin', label: 'Hua Hin', countryCode: 'TH' },
  { slug: 'koh_samui', label: 'Koh Samui', countryCode: 'TH' },
];

export const LOCATION_AREAS: LocationArea[] = [
  { slug: 'sukhumvit', label: 'Sukhumvit', regionSlug: 'bangkok' },
  { slug: 'sathorn', label: 'Sathorn', regionSlug: 'bangkok' },
  { slug: 'silom', label: 'Silom / Bang Rak', regionSlug: 'bangkok' },
  { slug: 'thonglor', label: 'Thong Lo / Ekkamai', regionSlug: 'bangkok' },
  { slug: 'ladprao', label: 'Lat Phrao / Chatuchak', regionSlug: 'bangkok' },
  { slug: 'bang_na', label: 'Bang Na / On Nut', regionSlug: 'bangkok' },
  { slug: 'rama_9', label: 'Rama IX / Ratchada', regionSlug: 'bangkok' },
  { slug: 'phrom_phong', label: 'Phrom Phong', regionSlug: 'bangkok' },
  { slug: 'phuket_town', label: 'Phuket Town', regionSlug: 'phuket' },
  { slug: 'patong', label: 'Patong', regionSlug: 'phuket' },
  { slug: 'bang_tao', label: 'Bang Tao / Laguna', regionSlug: 'phuket' },
  { slug: 'cm_city', label: 'Chiang Mai City', regionSlug: 'chiang_mai' },
  { slug: 'cm_nimman', label: 'Nimman / Old City', regionSlug: 'chiang_mai' },
  { slug: 'pattaya_central', label: 'Pattaya Central', regionSlug: 'pattaya' },
  { slug: 'jomtien', label: 'Jomtien', regionSlug: 'pattaya' },
  { slug: 'hua_hin_town', label: 'Hua Hin Town', regionSlug: 'hua_hin' },
  { slug: 'chaweng', label: 'Chaweng', regionSlug: 'koh_samui' },
  { slug: 'bophut', label: 'Bophut / Fisherman\'s Village', regionSlug: 'koh_samui' },
];

export const DEFAULT_SERVICE_LOCATIONS: ServiceLocation[] = [
  { regionSlug: DEFAULT_LOCATION_REGION_SLUG },
];
