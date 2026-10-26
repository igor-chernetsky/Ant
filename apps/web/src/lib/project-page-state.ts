export type ProjectPageLoadState = 'ok' | 'missing' | 'error';

export interface ProjectPageDecisionInput {
  state: ProjectPageLoadState;
  /**
   * The request carries something that could unlock the project: a session
   * (owner, participant, admin) or the guest token cookie for this project.
   */
  hasCredentials: boolean;
  hasInviteToken: boolean;
}

export type ProjectPageDecision = 'render' | 'not-found';

/**
 * Answer a real 404 for project URLs that cannot belong to anybody, and keep
 * rendering for everyone who might still have access.
 *
 * The public endpoint answers 404 both for a deleted project and for one that is
 * simply not public yet (a guest draft), and server rendering cannot know which
 * without the caller's cookies. So:
 *
 * - a loaded project, or a failed backend call, renders (the client resolves the
 *   real view and retries after a session refresh);
 * - an invite link renders — that flow unlocks non-public projects on the client;
 * - a 404 with no session, no guest token and no invite is a genuine dead URL and
 *   becomes an HTTP 404, so search engines stop seeing a 200 "not found" page.
 */
export function resolveProjectPageDecision(
  input: ProjectPageDecisionInput,
): ProjectPageDecision {
  if (input.state !== 'missing') {
    return 'render';
  }
  if (input.hasInviteToken) {
    return 'render';
  }
  return input.hasCredentials ? 'render' : 'not-found';
}
