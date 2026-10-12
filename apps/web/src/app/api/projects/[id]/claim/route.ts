import { NextResponse } from 'next/server';
import { proxyBackendJson } from '@/lib/backend-proxy';
import {
  clearGuestProjectToken,
  readGuestProjectToken,
} from '@/lib/guest-project';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

/**
 * Attach the guest project this browser was filling in to the signed-in
 * account. Called right after the visitor registers (or signs in), which is the
 * moment publishing for bids becomes possible.
 */
export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const guestToken = await readGuestProjectToken(id);
  if (!guestToken) {
    return NextResponse.json(
      { message: 'No guest project to claim' },
      { status: 400 },
    );
  }

  const response = await proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/claim`,
    {
      method: 'POST',
      headers: { 'x-ant-guest-token': guestToken },
    },
  );

  if (response.ok) {
    // The project now belongs to the account: the guest path is closed.
    await clearGuestProjectToken(id);
  }

  return response;
}
