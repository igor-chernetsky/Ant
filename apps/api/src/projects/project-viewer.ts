import { ForbiddenException } from '@nestjs/common';

/**
 * Who is acting on a project.
 *
 * A registered owner (`user`) or the anonymous guest who created the project
 * and still holds its token. Guest projects have `clientId === null` until they
 * are claimed, so ownership cannot be expressed as a user id alone.
 */
export type ProjectViewer =
  | { kind: 'user'; userId: string }
  | { kind: 'guest'; projectId: string };

export function userViewer(userId: string): ProjectViewer {
  return { kind: 'user', userId };
}

export function guestViewer(projectId: string): ProjectViewer {
  return { kind: 'guest', projectId };
}

export function isGuestViewer(viewer: ProjectViewer): boolean {
  return viewer.kind === 'guest';
}

/** True when this viewer owns the project row. */
export function viewerOwnsProject(
  project: { id: string; clientId: string | null },
  viewer: ProjectViewer,
): boolean {
  if (viewer.kind === 'guest') {
    // The guard already proved the token matches this project; claiming closes
    // the guest path, so an owned project is never guest-writable.
    return project.id === viewer.projectId && project.clientId === null;
  }
  return project.clientId === viewer.userId;
}

export function assertViewerOwnsProject(
  project: { id: string; clientId: string | null },
  viewer: ProjectViewer,
): void {
  if (!viewerOwnsProject(project, viewer)) {
    throw new ForbiddenException('Access denied');
  }
}

/** Owner id when the viewer is a registered user, otherwise null. */
export function viewerUserId(viewer: ProjectViewer): string | null {
  return viewer.kind === 'user' ? viewer.userId : null;
}
