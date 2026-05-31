import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export function extractRoles(user: {
  realm_access?: { roles?: string[] };
}): string[] {
  return user.realm_access?.roles ?? [];
}

export function hasRole(
  user: { realm_access?: { roles?: string[] } },
  role: string,
): boolean {
  return extractRoles(user).includes(role);
}
