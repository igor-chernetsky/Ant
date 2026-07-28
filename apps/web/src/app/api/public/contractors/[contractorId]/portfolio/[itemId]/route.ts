import { NextResponse } from 'next/server';
import { getBackendApiUrl } from '@/lib/auth-server';

type RouteContext = {
  params: Promise<{ contractorId: string; itemId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { contractorId, itemId } = await context.params;
  const response = await fetch(
    `${getBackendApiUrl()}/v1/public/contractors/${encodeURIComponent(contractorId)}/portfolio/${encodeURIComponent(itemId)}/download-url`,
    {
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    return NextResponse.json(
      { message: 'Failed to load portfolio image' },
      { status: response.status },
    );
  }

  const body = (await response.json()) as { downloadUrl?: string };
  if (!body.downloadUrl) {
    return NextResponse.json(
      { message: 'Failed to load portfolio image' },
      { status: 502 },
    );
  }

  return NextResponse.redirect(body.downloadUrl);
}
