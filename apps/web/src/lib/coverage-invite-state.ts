/**
 * Whether the "invite from directory" affordance may be shown and pressed.
 *
 * The API accepts an invite only while the project is `in_tender` or
 * `clarification` and the tender is open/draft. The notice used to render an always
 * enabled button, so before publishing the client saw a button and then got
 * "Invites are only available during tender publication or clarification".
 */

export interface CoverageInviteInput {
  /** A handler was passed, i.e. inviting is possible in principle. */
  hasHandler: boolean;
  alwaysSuggestInvite: boolean;
  isDesign: boolean;
  /** Few matching professionals — inviting is worth suggesting. */
  lowMatchInvite: boolean;
  /** Why the action cannot run now; `undefined` means it can. */
  disabledReason?: string;
}

export interface CoverageInviteState {
  visible: boolean;
  enabled: boolean;
  hint?: string;
}

export function resolveCoverageInvite(
  input: CoverageInviteInput,
): CoverageInviteState {
  const wanted = input.hasHandler
    ? input.alwaysSuggestInvite || input.isDesign || input.lowMatchInvite
    : false;

  if (!wanted && !input.disabledReason) {
    return { visible: false, enabled: false };
  }

  if (input.disabledReason) {
    return { visible: true, enabled: false, hint: input.disabledReason };
  }

  return { visible: true, enabled: true };
}
