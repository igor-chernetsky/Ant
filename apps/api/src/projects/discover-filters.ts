import {
  Prisma,
  ProjectType,
  PropertyOwnershipForm,
  PropertyType,
} from '@prisma/client';

export const SERVICE_FILTER_SLUGS = [
  'renovation',
  'modernization',
  'new_construction',
  'new_construction.residential',
  'new_construction.commercial',
  'new_construction.extension',
  'new_construction.industrial',
  'design',
  'design.architectural',
  'design.interior',
  'design.engineering',
  'design.permits',
] as const;

export type ServiceFilterSlug = (typeof SERVICE_FILTER_SLUGS)[number];

export const PROPERTY_OWNERSHIP_FILTER_SLUGS = [
  'employer_title',
  'leasehold',
  'developer_consent',
] as const;

export type PropertyOwnershipFilterSlug =
  (typeof PROPERTY_OWNERSHIP_FILTER_SLUGS)[number];

const NEW_CONSTRUCTION_TYPES: ProjectType[] = [
  ProjectType.new_build,
  ProjectType.extension,
  ProjectType.commercial_fitout,
];

const RESIDENTIAL_PROPERTY_TYPES: PropertyType[] = [
  PropertyType.apartment,
  PropertyType.house,
];

const ENGINEERING_TAG_SLUGS = [
  'structural',
  'hvac',
  'electrical',
  'plumbing',
] as const;

export function normalizeServiceFilterSlugs(raw: string[]): ServiceFilterSlug[] {
  const allowed = new Set<string>(SERVICE_FILTER_SLUGS);
  return [...new Set(raw.map((value) => value.trim()).filter(Boolean))].filter(
    (value): value is ServiceFilterSlug => allowed.has(value),
  );
}

export function normalizeOwnershipFilterSlugs(
  raw: string[],
): PropertyOwnershipFilterSlug[] {
  const allowed = new Set<string>(PROPERTY_OWNERSHIP_FILTER_SLUGS);
  return [...new Set(raw.map((value) => value.trim()).filter(Boolean))].filter(
    (value): value is PropertyOwnershipFilterSlug => allowed.has(value),
  );
}

export function buildServiceFilter(
  serviceSlugs: ServiceFilterSlug[],
): Prisma.ProjectWhereInput | undefined {
  if (serviceSlugs.length === 0) {
    return undefined;
  }

  const orClauses = serviceSlugs
    .map((slug) => serviceSlugToWhere(slug))
    .filter((clause): clause is Prisma.ProjectWhereInput => clause !== null);

  if (orClauses.length === 0) {
    return undefined;
  }

  return orClauses.length === 1 ? orClauses[0] : { OR: orClauses };
}

export function buildOwnershipFilter(
  ownershipSlugs: PropertyOwnershipFilterSlug[],
): Prisma.ProjectWhereInput | undefined {
  if (ownershipSlugs.length === 0) {
    return undefined;
  }

  const forms = ownershipSlugs.map(
    (slug) => slug as PropertyOwnershipForm,
  );

  return {
    OR: forms.map((form) => ({
      propertyOwnershipForm: form,
    })),
  };
}

function serviceSlugToWhere(
  slug: ServiceFilterSlug,
): Prisma.ProjectWhereInput | null {
  switch (slug) {
    case 'renovation':
      return {
        projectType: { in: [ProjectType.renovation, ProjectType.repair] },
      };
    case 'modernization':
      return {
        OR: [
          { projectType: ProjectType.modernization_reconstruction },
          { tags: { some: { tag: { slug: 'modernization' } } } },
        ],
      };
    case 'new_construction':
      return { projectType: { in: NEW_CONSTRUCTION_TYPES } };
    case 'new_construction.residential':
      return {
        AND: [
          {
            projectType: {
              in: [ProjectType.new_build, ProjectType.extension],
            },
          },
          {
            OR: [
              { propertyType: { in: RESIDENTIAL_PROPERTY_TYPES } },
              { propertyType: null },
            ],
          },
        ],
      };
    case 'new_construction.commercial':
      return {
        OR: [
          { projectType: ProjectType.commercial_fitout },
          {
            AND: [
              { projectType: { in: NEW_CONSTRUCTION_TYPES } },
              { propertyType: PropertyType.commercial },
            ],
          },
        ],
      };
    case 'new_construction.extension':
      return { projectType: ProjectType.extension };
    case 'new_construction.industrial':
      return {
        AND: [
          { projectType: ProjectType.new_build },
          {
            OR: [
              { propertyType: PropertyType.land },
              { tags: { some: { tag: { slug: { in: ['structural', 'concrete'] } } } } },
            ],
          },
        ],
      };
    case 'design':
      return designBaseWhere();
    case 'design.architectural':
      return {
        OR: [
          {
            AND: [
              designBaseWhere(),
              {
                OR: [
                  { propertyType: { in: [PropertyType.land, PropertyType.house] } },
                  { propertyType: null },
                ],
              },
            ],
          },
          { projectType: ProjectType.design },
        ],
      };
    case 'design.interior':
      return {
        AND: [
          designBaseWhere(),
          {
            tags: {
              some: { tag: { slug: { in: ['finishing', 'flooring', 'tiling', 'painting'] } } },
            },
          },
        ],
      };
    case 'design.engineering':
      return {
        AND: [
          designBaseWhere(),
          {
            tags: {
              some: {
                tag: { slug: { in: [...ENGINEERING_TAG_SLUGS] } },
              },
            },
          },
        ],
      };
    case 'design.permits':
      return {
        tags: { some: { tag: { slug: 'permits' } } },
      };
    default:
      return null;
  }
}

function designBaseWhere(): Prisma.ProjectWhereInput {
  return {
    OR: [
      { projectType: ProjectType.design },
      { tags: { some: { tag: { slug: 'design' } } } },
      {
        briefJson: {
          path: ['design', 'needsDesignTender'],
          equals: true,
        },
      },
    ],
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
