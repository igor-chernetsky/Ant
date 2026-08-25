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

const CONVERT_TO_DESIGN_STATUSES: ProjectStatus[] = [
  ProjectStatus.draft,
  ProjectStatus.intake,
  ProjectStatus.ready_for_estimate,
  ProjectStatus.estimated,
];

/** Statuses where convert is allowed only before any tender responses exist. */
const CONVERT_TO_DESIGN_PRE_TENDER_STATUSES: ProjectStatus[] = [
  ProjectStatus.clarification,
  ProjectStatus.in_tender,
];

export function canClientConvertToDesign(input: {
  projectType: ProjectType;
  status: ProjectStatus;
  linkKind: ProjectLinkKind;
  linkedProjectId: string | null;
  tenderBidCount?: number;
}): boolean {
  if (!isConvertibleToDesign(input.projectType)) {
    return false;
  }
  if (
    input.linkKind === ProjectLinkKind.design_active ||
    input.linkKind === ProjectLinkKind.construction_pending ||
    input.linkedProjectId
  ) {
    return false;
  }
  if (CONVERT_TO_DESIGN_STATUSES.includes(input.status)) {
    return true;
  }
  if (
    CONVERT_TO_DESIGN_PRE_TENDER_STATUSES.includes(input.status) &&
    (input.tenderBidCount ?? 0) === 0
  ) {
    return true;
  }
  return false;
}

/** Statuses where the owner may still change construction Project/Work type. */
export const PROJECT_TYPE_EDITABLE_STATUSES: ProjectStatus[] = [
  ProjectStatus.draft,
  ProjectStatus.intake,
  ProjectStatus.ready_for_estimate,
  ProjectStatus.estimated,
];

export function canEditConstructionProjectType(
  projectType: ProjectType,
  status: ProjectStatus,
): boolean {
  return (
    projectType !== ProjectType.design &&
    PROJECT_TYPE_EDITABLE_STATUSES.includes(status)
  );
}
