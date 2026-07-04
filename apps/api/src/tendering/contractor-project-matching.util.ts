/**
 * Shared rules for matching contractors to a project (notifications, coverage UI).
 */
export function contractorProjectTypeMatches(
  contractorProjectTypes: string[],
  projectType: string,
): boolean {
  return (
    contractorProjectTypes.length === 0 ||
    contractorProjectTypes.includes(projectType)
  );
}

export function contractorTagsMatchProject(
  contractorTagSlugs: string[],
  projectTagSlugs: string[],
): boolean {
  if (projectTagSlugs.length === 0) {
    return true;
  }
  if (contractorTagSlugs.length === 0) {
    return false;
  }
  return projectTagSlugs.every((slug) => contractorTagSlugs.includes(slug));
}
