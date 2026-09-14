import { NextResponse } from 'next/server';
import { grantRealmRoleToUser } from '@/lib/auth-keycloak-admin';
import { proxyBackend } from '@/lib/backend-proxy';

interface SupplyRoleGap {
  userId: string;
  kind: 'contractor' | 'designer';
  companyName: string | null;
  email: string | null;
  displayName: string | null;
  keycloakSub: string;
}

/**
 * Backfill the Keycloak realm role for supply profiles that were created before
 * the role became mandatory. The candidate list comes from the API (admin-only),
 * so the request is authorised before any role is granted.
 */
export async function POST() {
  const { response } = await proxyBackend(
    '/v1/admin/contractors/supply-role-gaps',
  );

  if (!response.ok) {
    return NextResponse.json(
      { message: 'Failed to load accounts with missing roles' },
      { status: response.status },
    );
  }

  const gaps = (await response.json().catch(() => null)) as
    | SupplyRoleGap[]
    | null;
  if (!Array.isArray(gaps)) {
    return NextResponse.json(
      { message: 'Unexpected response from the API' },
      { status: 502 },
    );
  }

  const granted: string[] = [];
  const skipped: string[] = [];
  const failed: Array<{ email: string | null; message: string }> = [];

  for (const gap of gaps) {
    const result = await grantRealmRoleToUser({
      keycloakUserId: gap.keycloakSub,
      role: gap.kind,
    });
    if (result.ok && result.alreadyHeld) {
      skipped.push(gap.email ?? gap.userId);
    } else if (result.ok) {
      granted.push(gap.email ?? gap.userId);
    } else {
      failed.push({
        email: gap.email,
        message: result.message ?? 'Failed to assign role',
      });
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: gaps.length,
    granted,
    skipped,
    failed,
  });
}
