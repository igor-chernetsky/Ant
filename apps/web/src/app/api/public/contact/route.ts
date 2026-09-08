import { proxyOptionalBackendJson } from '@/lib/backend-proxy';

export async function POST(request: Request) {
  const body = await request.text();
  // Guests are allowed to submit the contact form. Forward the real client IP
  // so the API can rate-limit per IP (the backend only sees the Vercel host).
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  return proxyOptionalBackendJson('/v1/public/contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(clientIp ? { 'x-client-ip': clientIp } : {}),
    },
    body,
  });
}
