const SELF_ASSIGNABLE_ROLES = ['client', 'contractor', 'designer'] as const;
type SelfAssignableRole = (typeof SELF_ASSIGNABLE_ROLES)[number];

interface KeycloakAdminTokenResponse {
  access_token?: string;
}

interface KeycloakRoleRepresentation {
  id: string;
  name: string;
}

interface KeycloakUserRepresentation {
  id?: string;
  username?: string;
  email?: string;
  enabled?: boolean;
  emailVerified?: boolean;
  firstName?: string;
  lastName?: string;
  requiredActions?: string[];
}

interface KeycloakCredentialRepresentation {
  type?: string;
  temporary?: boolean;
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
    const response = await fetch(masterTokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      cache: 'no-store',
    });
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

  const response = await fetch(
    `${baseUrl}/admin/realms/${realm}/users/${userId}/role-mappings/realm`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(roleRepresentations),
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    console.warn(
      `[auth-keycloak] assignRealmRoles failed (${response.status}):`,
      await response.text().catch(() => ''),
    );
  }
}

async function fetchKeycloakUser(
  adminToken: string,
  userId: string,
): Promise<KeycloakUserRepresentation | null> {
  const { baseUrl, realm } = getKeycloakBaseAndRealm();
  const response = await fetch(
    `${baseUrl}/admin/realms/${realm}/users/${userId}`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
      cache: 'no-store',
    },
  );
  if (!response.ok) return null;
  return (await response.json()) as KeycloakUserRepresentation;
}

async function fetchUserCredentials(
  adminToken: string,
  userId: string,
): Promise<KeycloakCredentialRepresentation[]> {
  const { baseUrl, realm } = getKeycloakBaseAndRealm();
  const response = await fetch(
    `${baseUrl}/admin/realms/${realm}/users/${userId}/credentials`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
      cache: 'no-store',
    },
  );
  if (!response.ok) return [];
  return (await response.json()) as KeycloakCredentialRepresentation[];
}

async function userHasPasswordCredential(
  adminToken: string,
  userId: string,
): Promise<boolean> {
  const credentials = await fetchUserCredentials(adminToken, userId);
  return credentials.some((credential) => credential.type === 'password');
}

async function finalizeKeycloakUser(
  adminToken: string,
  userId: string,
): Promise<void> {
  const { baseUrl, realm } = getKeycloakBaseAndRealm();
  const user = await fetchKeycloakUser(adminToken, userId);

  const payload: KeycloakUserRepresentation = {
    id: userId,
    username: user?.username,
    email: user?.email,
    firstName: user?.firstName,
    lastName: user?.lastName,
    enabled: true,
    emailVerified: true,
    requiredActions: [],
  };

  const response = await fetch(
    `${baseUrl}/admin/realms/${realm}/users/${userId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    console.warn(
      `[auth-keycloak] finalizeKeycloakUser failed (${response.status}):`,
      await response.text().catch(() => ''),
    );
    return;
  }

  const updated = await fetchKeycloakUser(adminToken, userId);
  if (updated?.requiredActions && updated.requiredActions.length > 0) {
    console.warn(
      `[auth-keycloak] user ${userId} still has required actions:`,
      updated.requiredActions.join(', '),
    );
  }
}

async function setKeycloakUserPassword(
  adminToken: string,
  userId: string,
  password: string,
): Promise<boolean> {
  const { baseUrl, realm } = getKeycloakBaseAndRealm();
  const response = await fetch(
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
        value: password,
      }),
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    console.warn(
      `[auth-keycloak] setKeycloakUserPassword failed (${response.status}):`,
      await response.text().catch(() => ''),
    );
    return false;
  }

  return true;
}

async function findKeycloakUserByLogin(
  adminToken: string,
  login: string,
): Promise<KeycloakUserRepresentation | null> {
  const { baseUrl, realm } = getKeycloakBaseAndRealm();
  const normalized = login.trim().toLowerCase();

  for (const query of [
    `email=${encodeURIComponent(normalized)}&exact=true`,
    `username=${encodeURIComponent(normalized)}&exact=true`,
  ]) {
    const response = await fetch(
      `${baseUrl}/admin/realms/${realm}/users?${query}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        cache: 'no-store',
      },
    );
    if (!response.ok) continue;
    const users = (await response.json()) as KeycloakUserRepresentation[];
    if (users[0]?.id) {
      return users[0];
    }
  }

  return null;
}

/** Login identifiers to try with Keycloak password grant. */
export async function resolveKeycloakLoginIdentifiers(
  login: string,
): Promise<string[]> {
  const normalized = login.trim().toLowerCase();
  const identifiers = new Set<string>([normalized]);

  let adminToken: string | null = null;
  try {
    adminToken = await fetchAdminAccessToken();
  } catch {
    return [...identifiers];
  }
  if (!adminToken) {
    return [...identifiers];
  }

  const user = await findKeycloakUserByLogin(adminToken, normalized);
  if (user?.username) {
    identifiers.add(user.username.trim().toLowerCase());
  }
  if (user?.email) {
    identifiers.add(user.email.trim().toLowerCase());
  }

  return [...identifiers];
}

export async function diagnoseKeycloakLoginFailure(
  login: string,
): Promise<{ code: string; detail: string } | null> {
  let adminToken: string | null = null;
  try {
    adminToken = await fetchAdminAccessToken();
  } catch {
    return null;
  }
  if (!adminToken) {
    return null;
  }

  const user = await findKeycloakUserByLogin(adminToken, login);
  if (!user?.id) {
    return {
      code: 'user_not_found',
      detail: 'No Keycloak user with this email or username.',
    };
  }

  if (user.enabled === false) {
    return {
      code: 'user_disabled',
      detail: 'User account is disabled in Keycloak.',
    };
  }

  if (user.requiredActions && user.requiredActions.length > 0) {
    return {
      code: 'account_not_ready',
      detail: `Required actions: ${user.requiredActions.join(', ')}`,
    };
  }

  const hasPassword = await userHasPasswordCredential(adminToken, user.id);
  if (!hasPassword) {
    return {
      code: 'password_not_configured',
      detail:
        'No password credential on this user. Set password in Keycloak Admin → Users → Credentials, or sign up again.',
    };
  }

  if (user.username && user.username.toLowerCase() !== login.trim().toLowerCase()) {
    return {
      code: 'invalid_credentials',
      detail: `Keycloak username is "${user.username}". Sign in with that username or the account email.`,
    };
  }

  return null;
}

/** Clear required actions; optionally re-set password (signup repair). */
export async function repairKeycloakUserAuth(
  login: string,
  password?: string,
): Promise<boolean> {
  let adminToken: string | null = null;
  try {
    adminToken = await fetchAdminAccessToken();
  } catch {
    return false;
  }
  if (!adminToken) {
    return false;
  }

  const user = await findKeycloakUserByLogin(adminToken, login);
  if (!user?.id) {
    return false;
  }

  await finalizeKeycloakUser(adminToken, user.id);

  if (password) {
    return setKeycloakUserPassword(adminToken, user.id, password);
  }

  const hasPassword = await userHasPasswordCredential(adminToken, user.id);
  return hasPassword;
}

export function shouldAttemptKeycloakAuthRepair(result: {
  error: string;
  description?: string;
}): boolean {
  const description = (result.description ?? '').toLowerCase();
  if (
    result.error === 'invalid_grant' &&
    (description.includes('invalid user credentials') ||
      description.includes('invalid username or password'))
  ) {
    return false;
  }

  return (
    result.error === 'invalid_grant' ||
    description.includes('not fully set up') ||
    description.includes('account is not fully set up')
  );
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
      requiredActions: [],
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
    const detail = await createResponse.text().catch(() => '');
    console.error('[auth-keycloak] create user failed:', createResponse.status, detail);
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

  await assignRealmRoles(adminToken, userId, normalizedRoles);
  await finalizeKeycloakUser(adminToken, userId);

  const passwordSet = await setKeycloakUserPassword(
    adminToken,
    userId,
    params.password,
  );
  if (!passwordSet) {
    return {
      ok: false,
      status: 500,
      message: 'User created, but failed to set password',
    };
  }

  const hasPassword = await userHasPasswordCredential(adminToken, userId);
  if (!hasPassword) {
    return {
      ok: false,
      status: 500,
      message: 'User created, but password credential was not saved',
    };
  }

  return { ok: true };
}
