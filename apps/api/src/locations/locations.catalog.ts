export const DEFAULT_LOCATION_REGION_SLUG = 'bangkok';

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

export interface ProjectLocation {
  regionSlug: string;
  areaSlug?: string | null;
  note?: string | null;
}

export const LOCATION_REGIONS: LocationRegion[] = [
  { slug: 'bangkok', label: 'Bangkok', countryCode: 'TH', lat: 13.7563, lng: 100.5018 },
  { slug: 'phuket', label: 'Phuket', countryCode: 'TH', lat: 7.8804, lng: 98.3923 },
  { slug: 'chiang_mai', label: 'Chiang Mai', countryCode: 'TH', lat: 18.7883, lng: 98.9853 },
  { slug: 'pattaya', label: 'Pattaya / Chonburi', countryCode: 'TH', lat: 12.9236, lng: 100.8825 },
  { slug: 'hua_hin', label: 'Hua Hin', countryCode: 'TH', lat: 12.5684, lng: 99.9577 },
  { slug: 'koh_samui', label: 'Koh Samui', countryCode: 'TH', lat: 9.512, lng: 100.0136 },
];

export const LOCATION_AREAS: LocationArea[] = [
  { slug: 'sukhumvit', label: 'Sukhumvit', regionSlug: 'bangkok', lat: 13.7392, lng: 100.5698 },
  { slug: 'sathorn', label: 'Sathorn', regionSlug: 'bangkok', lat: 13.7189, lng: 100.5263 },
  { slug: 'silom', label: 'Silom / Bang Rak', regionSlug: 'bangkok', lat: 13.7244, lng: 100.5297 },
  { slug: 'thonglor', label: 'Thong Lo / Ekkamai', regionSlug: 'bangkok', lat: 13.7336, lng: 100.5804 },
  { slug: 'ladprao', label: 'Lat Phrao / Chatuchak', regionSlug: 'bangkok', lat: 13.8167, lng: 100.6033 },
  { slug: 'bang_na', label: 'Bang Na / On Nut', regionSlug: 'bangkok', lat: 13.6684, lng: 100.6417 },
  { slug: 'rama_9', label: 'Rama IX / Ratchada', regionSlug: 'bangkok', lat: 13.758, lng: 100.566 },
  { slug: 'phrom_phong', label: 'Phrom Phong', regionSlug: 'bangkok', lat: 13.7307, lng: 100.5695 },
  { slug: 'phuket_town', label: 'Phuket Town', regionSlug: 'phuket', lat: 7.8804, lng: 98.3923 },
  { slug: 'patong', label: 'Patong', regionSlug: 'phuket', lat: 7.8965, lng: 98.2965 },
  { slug: 'bang_tao', label: 'Bang Tao / Laguna', regionSlug: 'phuket', lat: 7.9789, lng: 98.2866 },
  { slug: 'cm_city', label: 'Chiang Mai City', regionSlug: 'chiang_mai', lat: 18.7883, lng: 98.9853 },
  { slug: 'cm_nimman', label: 'Nimman / Old City', regionSlug: 'chiang_mai', lat: 18.7967, lng: 98.9683 },
  { slug: 'pattaya_central', label: 'Pattaya Central', regionSlug: 'pattaya', lat: 12.9236, lng: 100.8825 },
  { slug: 'jomtien', label: 'Jomtien', regionSlug: 'pattaya', lat: 12.8777, lng: 100.8665 },
  { slug: 'hua_hin_town', label: 'Hua Hin Town', regionSlug: 'hua_hin', lat: 12.5684, lng: 99.9577 },
  { slug: 'chaweng', label: 'Chaweng', regionSlug: 'koh_samui', lat: 9.535, lng: 100.0618 },
  { slug: 'bophut', label: "Bophut / Fisherman's Village", regionSlug: 'koh_samui', lat: 9.555, lng: 100.026 },
];

export const DEFAULT_SERVICE_LOCATIONS: ServiceLocation[] = [
  { regionSlug: DEFAULT_LOCATION_REGION_SLUG },
];
