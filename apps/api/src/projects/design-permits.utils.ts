import {
  ProjectLinkKind,
  ProjectStatus,
  ProjectType,
  PropertyType,
  SupplyProfileKind,
} from '@prisma/client';

/** Project types that can be converted into Design & Permits. */
export const CONVERTIBLE_TO_DESIGN_TYPES: ProjectType[] = [
  ProjectType.new_build,
  ProjectType.extension,
  ProjectType.commercial_fitout,
  ProjectType.renovation,
  ProjectType.modernization_reconstruction,
  ProjectType.repair,
];

/** Types that show the convert-to-design hint tooltip. */
export const DESIGN_CONVERT_HINT_TYPES: ProjectType[] = [
  ProjectType.new_build,
  ProjectType.extension,
  ProjectType.commercial_fitout,
  ProjectType.modernization_reconstruction,
  ProjectType.repair,
];

export type DesignFeeCategory =
  | 'residential'
  | 'commercial'
  | 'industrial_public'
  | 'other';

export const DESIGN_FEE_PERCENTS: Record<DesignFeeCategory, number> = {
  residential: 10,
  commercial: 8,
  industrial_public: 5,
  other: 8,
};

const INDUSTRIAL_PUBLIC_TAG_SLUGS = new Set([
  'industrial',
  'infrastructure',
  'public',
  'industrial-infrastructure',
]);

export function resolveDesignFeeCategory(input: {
  propertyType?: PropertyType | null;
  tagSlugs?: string[];
}): DesignFeeCategory {
  const tags = (input.tagSlugs ?? []).map((s) => s.toLowerCase());
  if (tags.some((slug) => INDUSTRIAL_PUBLIC_TAG_SLUGS.has(slug))) {
    return 'industrial_public';
  }

  switch (input.propertyType) {
    case PropertyType.residential:
      return 'residential';
    case PropertyType.commercial:
      return 'commercial';
    case PropertyType.industrial_infrastructure:
    case PropertyType.public:
      return 'industrial_public';
    default:
      return 'other';
  }
}

export function designFeePercentFor(input: {
  propertyType?: PropertyType | null;
  tagSlugs?: string[];
}): number {
  return DESIGN_FEE_PERCENTS[resolveDesignFeeCategory(input)];
}

export function requiredSupplyKindForProjectType(
  projectType: ProjectType,
): SupplyProfileKind {
  return projectType === ProjectType.design
    ? SupplyProfileKind.designer
    : SupplyProfileKind.contractor;
}

export function isConvertibleToDesign(projectType: ProjectType): boolean {
  return CONVERTIBLE_TO_DESIGN_TYPES.includes(projectType);
}

/** Default construction type when branching from a standalone design card. */
export const DEFAULT_CONSTRUCTION_TYPE_FROM_DESIGN = ProjectType.new_build;

const DESIGN_TO_CONSTRUCTION_BLOCKED_STATUSES: ProjectStatus[] = [
  ProjectStatus.clarification,
  ProjectStatus.in_tender,
  ProjectStatus.awarded,
  ProjectStatus.active,
  ProjectStatus.completed,
  ProjectStatus.pending,
];

export function canResumeConstruction(
  project: {
    projectType: ProjectType;
    status: ProjectStatus;
    linkedProjectId: string | null;
  },
  linkedConstruction?: {
    status: ProjectStatus;
    linkKind: ProjectLinkKind;
  } | null,
): boolean {
  if (project.projectType !== ProjectType.design) {
    return false;
  }
  if (DESIGN_TO_CONSTRUCTION_BLOCKED_STATUSES.includes(project.status)) {
    return false;
  }
  if (!project.linkedProjectId) {
    return true;
  }
  if (!linkedConstruction) {
    return false;
  }
  return (
    linkedConstruction.status === ProjectStatus.pending &&
    linkedConstruction.linkKind === ProjectLinkKind.construction_pending
  );
}
