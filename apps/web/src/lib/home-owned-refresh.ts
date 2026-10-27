export interface OwnedRefreshInput {
  /** Projects the account owns, as the authenticated list call reports them. */
  ownedIds: Iterable<string>;
  /** Projects already rendered in the grid (fetched before the claim). */
  loadedIds: Iterable<string>;
}

/**
 * Should the project grid be fetched again after the owning account was resolved?
 *
 * `GET /v1/projects` also claims the guest drafts tagged with the account's
 * address. A draft claimed by that call is not part of the list rendered a moment
 * earlier, so without a refresh the client saw the new project only after a manual
 * reload (reported after confirming the e-mail).
 */
export function shouldRefreshAfterClaim({
  ownedIds,
  loadedIds,
}: OwnedRefreshInput): boolean {
  const loaded = new Set(loadedIds);
  for (const id of ownedIds) {
    if (!loaded.has(id)) {
      return true;
    }
  }
  return false;
}
