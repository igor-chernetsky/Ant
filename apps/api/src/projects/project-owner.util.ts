import { BadRequestException } from '@nestjs/common';

/**
 * Owner id of a project that must already have one.
 *
 * `Project.clientId` is null only while an anonymous guest is still filling the
 * project in. Everything downstream of intake — tenders, contracts, reviews,
 * clarifications, progress — requires a registered owner, so reaching those
 * paths without one is either a direct API call or a bug. Both deserve a clear
 * error instead of a null flowing into a query.
 */
export function requireClientId(project: { clientId: string | null }): string {
  if (!project.clientId) {
    throw new BadRequestException(
      'Project has no owner yet. Register to continue.',
    );
  }
  return project.clientId;
}
