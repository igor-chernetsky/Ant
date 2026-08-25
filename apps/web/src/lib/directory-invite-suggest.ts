import type { Tender } from '@/lib/tendering';

/** Hide the trade list in coverage copy when this many or more matches exist. */
export const DIRECTORY_INVITE_HIDE_TRADE_LIST_THRESHOLD = 4;

/** Suggest registry invites when this many or fewer matching profiles exist. */
export const DIRECTORY_INVITE_LOW_MATCH_THRESHOLD = 11;

/** Suggest registry invites when a published tender has no responses this long. */
export const DIRECTORY_INVITE_NO_RESPONSE_DAYS = 2;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * True when a published tender (open or clarification draft) has had no
 * applications/bids for at least DIRECTORY_INVITE_NO_RESPONSE_DAYS.
 */
export function tenderHasStaleEmptyResponses(
  tender: Pick<
    Tender,
    'status' | 'opensAt' | 'createdAt' | 'applicationCount' | 'bids'
  > | null,
  nowMs: number = Date.now(),
): boolean {
  if (!tender) {
    return false;
  }
  if (tender.status !== 'open' && tender.status !== 'draft') {
    return false;
  }
  const responses = Math.max(
    tender.applicationCount ?? 0,
    tender.bids?.length ?? 0,
  );
  if (responses > 0) {
    return false;
  }
  const startIso = tender.opensAt ?? tender.createdAt;
  if (!startIso) {
    return false;
  }
  const startMs = new Date(startIso).getTime();
  if (!Number.isFinite(startMs)) {
    return false;
  }
  return nowMs - startMs >= DIRECTORY_INVITE_NO_RESPONSE_DAYS * MS_PER_DAY;
}

export function shouldSuggestDirectoryInvite(input: {
  matchCount?: number | null;
  tender?: Tender | null;
  nowMs?: number;
}): boolean {
  if (
    typeof input.matchCount === 'number' &&
    input.matchCount <= DIRECTORY_INVITE_LOW_MATCH_THRESHOLD
  ) {
    return true;
  }
  return tenderHasStaleEmptyResponses(input.tender ?? null, input.nowMs);
}
