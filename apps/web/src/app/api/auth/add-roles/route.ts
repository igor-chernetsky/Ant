import { NextResponse } from 'next/server';
import { addKeycloakSelfAssignableRoles } from '@/lib/auth-keycloak-admin';
import {
  getValidAccessToken,
  persistAndApplyAuthCookies,
  refreshAccessTokenAfterUnauthorized,
} from '@/lib/auth-tokens';
import { decodeJwtPayload } from '@/lib/jwt-utils';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['client', 'contractor', 'designer']);

interface AddRolesBody {
  roles?: string[];
  acceptedAgreement?: boolean;
}

export async function POST(request: Request) {
  let body: AddRolesBody;
  try {
    body = (await request.json()) as AddRolesBody;
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
  }

  if (body.acceptedAgreement !== true) {
    return NextResponse.json(
      { message: 'You must accept the agreement for this role' },
      { status: 400 },
    );
  }

  const roles = Array.isArray(body.roles)
    ? body.roles
        .map((role) => role.trim().toLowerCase())
        .filter((role) => ALLOWED.has(role))
    : [];

  if (roles.length === 0) {
    return NextResponse.json(
      { message: 'Select a valid role to add' },
      { status: 400 },
    );
  }

  let auth = await getValidAccessToken();
  if (!auth.ok) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const payload = decodeJwtPayload(auth.accessToken);
  const keycloakUserId =
    typeof payload?.sub === 'string' ? payload.sub.trim() : '';
  if (!keycloakUserId) {
    return NextResponse.json(
      { message: 'Unable to resolve account' },
      { status: 401 },
    );
  }

  const result = await addKeycloakSelfAssignableRoles({
    keycloakUserId,
    roles,
  });

  if (!result.ok) {
    return NextResponse.json(
      { message: result.message },
      { status: result.status },
    );
  }

  // Force token refresh so the new realm role appears in JWT /me.
  const refreshed = await refreshAccessTokenAfterUnauthorized();
  const response = NextResponse.json({
    ok: true,
    added: result.added,
    alreadyHad: result.alreadyHad,
  });
  if (refreshed.ok && refreshed.refreshed) {
    await persistAndApplyAuthCookies(refreshed.refreshed, response);
  }
  return response;
}
