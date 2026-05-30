import { NextResponse } from 'next/server';
import { getBackendApiUrl } from '@/lib/auth-server';

export async function GET() {
  try {
    const backendResponse = await fetch(`${getBackendApiUrl()}/v1/public/tags`, {
      cache: 'no-store',
    });
    const text = await backendResponse.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : [];
    } catch {
      body = { message: text };
    }
    return NextResponse.json(body, { status: backendResponse.status });
  } catch {
    return NextResponse.json(
      { message: 'Unable to reach API server' },
      { status: 502 },
    );
  }
}
