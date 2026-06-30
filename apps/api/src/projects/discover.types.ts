export interface DiscoverLocationFilter {
  regionSlug?: string;
  areaSlug?: string;
}

export interface DiscoverQuery {
  tagSlugs?: string[];
  statuses?: string[];
  location?: DiscoverLocationFilter;
}
