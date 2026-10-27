export interface ProjectOwnershipInput {
  /** `clientId` from the project payload; null for an unclaimed guest draft. */
  projectClientId?: string | null;
  viewerId: string;
  viewerIsAdmin: boolean;
}

export interface ProjectOwnership {
  isOwner: boolean;
  /** Platform admin reading somebody else's project: full read, no owner actions. */
  isAdminViewer: boolean;
}

/**
 * Who is looking at the project?
 *
 * `GET /v1/projects/:id` answers the owner's payload, and it also answers admins
 * for any project — so "the call succeeded" no longer means "this is mine". The
 * payload carries `clientId`; when it is absent (an older API during a rolling
 * deploy) a non-admin caller is still the owner, because the owner endpoint only
 * ever answers its owner.
 */
export function resolveProjectOwnership(
  input: ProjectOwnershipInput,
): ProjectOwnership {
  const isOwner =
    input.projectClientId != null
      ? input.projectClientId === input.viewerId
      : !input.viewerIsAdmin;

  return {
    isOwner,
    isAdminViewer: !isOwner && input.viewerIsAdmin,
  };
}
