const SELF_ASSIGNABLE_ROLES = ['client', 'contractor', 'designer'] as const;
type SelfAssignableRole = (typeof SELF_ASSIGNABLE_ROLES)[number];

interface KeycloakAdminTokenResponse {
  access_token?: string;
}

interface KeycloakRoleRepresentation {
  id: string;
  name: string;
}

function getKeycloakBaseAndRealm(): { baseUrl: string; realm: string } {
  const baseUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL;
  const realm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM;
  if (!baseUrl || !realm) {
    throw new Error(
      'Missing NEXT_PUBLIC_KEYCLOAK_URL or NEXT_PUBLIC_KEYCLOAK_REALM',
    );
  }
  return { baseUrl, realm };
}

function getKeycloakAdminCredentials(): { username: string; password: string } {
  const username = process.env.KEYCLOAK_ADMIN ?? process.env.KEYCLOAK_ADMIN_USERNAME;
  const password = process.env.KEYCLOAK_ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error(
      'Missing KEYCLOAK_ADMIN/KEYCLOAK_ADMIN_PASSWORD for signup',
    );
  }
  return { username, password };
}

async function fetchAdminAccessToken(): Promise<string | null> {
  const { username, password } = getKeycloakAdminCredentials();
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username,
    password,
  });

  try {
    const baseUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL;
    if (!baseUrl) return null;
    const masterTokenUrl = `${baseUrl}/realms/master/protocol/openid-connect/token`;
    const response = await fetch(
      masterTokenUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        cache: 'no-store',
      },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as KeycloakAdminTokenResponse;
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

function normalizeRoles(roles: string[]): SelfAssignableRole[] {
  const allowed = new Set<string>(SELF_ASSIGNABLE_ROLES);
  const unique = new Set<string>();
  for (const role of roles) {
    const normalized = role.trim().toLowerCase();
    if (allowed.has(normalized)) unique.add(normalized);
  }
  if (unique.size === 0) unique.add('client');
  return [...unique] as SelfAssignableRole[];
}

async function fetchRoleRepresentation(
  adminToken: string,
  roleName: SelfAssignableRole,
): Promise<KeycloakRoleRepresentation | null> {
  const { baseUrl, realm } = getKeycloakBaseAndRealm();
  const response = await fetch(
    `${baseUrl}/admin/realms/${realm}/roles/${encodeURIComponent(roleName)}`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
      cache: 'no-store',
    },
  );
  if (!response.ok) return null;
  return (await response.json()) as KeycloakRoleRepresentation;
}

async function assignRealmRoles(
  adminToken: string,
  userId: string,
  roles: SelfAssignableRole[],
): Promise<void> {
  const { baseUrl, realm } = getKeycloakBaseAndRealm();
  const roleRepresentations = (
    await Promise.all(roles.map((role) => fetchRoleRepresentation(adminToken, role)))
  ).filter((role): role is KeycloakRoleRepresentation => Boolean(role));

  if (roleRepresentations.length === 0) return;

  await fetch(`${baseUrl}/admin/realms/${realm}/users/${userId}/role-mappings/realm`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(roleRepresentations),
    cache: 'no-store',
  });
}

function parseUserIdFromLocation(location: string | null): string | null {
  if (!location) return null;
  const segments = location.split('/').filter(Boolean);
  return segments.at(-1) ?? null;
}

export async function createKeycloakUser(params: {
  email: string;
  password: string;
  displayName?: string;
  roles: string[];
}): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  let adminToken: string | null = null;
  try {
    adminToken = await fetchAdminAccessToken();
  } catch {
    return {
      ok: false,
      status: 500,
      message:
        'Signup is not configured. Missing Keycloak admin credentials on server.',
    };
  }

  if (!adminToken) {
    return {
      ok: false,
      status: 503,
      message: 'Unable to connect to Keycloak admin API',
    };
  }

  const { baseUrl, realm } = getKeycloakBaseAndRealm();
  const normalizedRoles = normalizeRoles(params.roles);
  const username = params.email.trim().toLowerCase();
  const displayName = params.displayName?.trim() || '';

  const [firstName, ...rest] = displayName.split(' ').filter(Boolean);
  const lastName = rest.join(' ');

  const createResponse = await fetch(`${baseUrl}/admin/realms/${realm}/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      enabled: true,
      username,
      email: username,
      emailVerified: true,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
    }),
    cache: 'no-store',
  });

  if (createResponse.status === 409) {
    return {
      ok: false,
      status: 409,
      message: 'User with this email already exists',
    };
  }

  if (!createResponse.ok) {
    return {
      ok: false,
      status: createResponse.status,
      message: 'Failed to create user',
    };
  }

  const userId = parseUserIdFromLocation(createResponse.headers.get('location'));
  if (!userId) {
    return {
      ok: false,
      status: 500,
      message: 'Signup failed: user id not returned',
    };
  }

  const passwordResponse = await fetch(
    `${baseUrl}/admin/realms/${realm}/users/${userId}/reset-password`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'password',
        temporary: false,
        value: params.password,
      }),
      cache: 'no-store',
    },
  );

  if (!passwordResponse.ok) {
    return {
      ok: false,
      status: passwordResponse.status,
      message: 'User created, but failed to set password',
    };
  }

  await assignRealmRoles(adminToken, userId, normalizedRoles);
  return { ok: true };
}

