export const PROPERTY_TYPES = [
  'residential',
  'commercial',
  'industrial_infrastructure',
  'public',
  'other',
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export function propertyTypeI18nKey(slug: PropertyType): string {
  return `propertyType.${slug}`;
}
