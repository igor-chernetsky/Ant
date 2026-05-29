# Auth hardening — confidential BFF client

Move **password grant** off public clients. Only the Vercel server (Next.js Route Handlers) may exchange credentials for tokens.

| Client | Type | Direct access grants | Used by |
|--------|------|----------------------|---------|
| `platform-web` | Public | **OFF** | Future browser OIDC / PKCE (optional) |
| `platform-bff` | **Confidential** | **ON** | Vercel `/api/auth/login` only |
| `platform-api` | Public | **OFF** | JWT validation reference (no login) |

---

## 1. Create client in Keycloak (existing EC2)

Admin → realm **`construction-marketplace`** → **Clients** → **Create client**

| Field | Value |
|-------|--------|
| Client type | OpenID Connect |
| Client ID | `platform-bff` |
| Name | Platform BFF (Vercel server) |

**Capability config:**

| Setting | Value |
|---------|--------|
| Client authentication | **ON** |
| Authorization | OFF |
| Standard flow | OFF |
| Direct access grants | **ON** |
| Service accounts | OFF |

Save → **Credentials** tab → copy **Client secret** (or regenerate).

---

## 2. Lock down public clients

### `platform-web`

**Settings** → Direct access grants → **OFF**  
(Client authentication stays **OFF**)

### `platform-api`

Direct access grants → **OFF** (if enabled for curl tests)

---

## 3. Vercel environment variables

Add **server-only** secrets (Production + Preview):

```env
KEYCLOAK_BFF_CLIENT_ID=platform-bff
KEYCLOAK_BFF_CLIENT_SECRET=<paste from Keycloak Credentials tab>
```

Keep existing:

```env
NEXT_PUBLIC_KEYCLOAK_URL=https://iabuilding.duckdns.org/auth
NEXT_PUBLIC_KEYCLOAK_REALM=construction-marketplace
NEXT_PUBLIC_API_URL=https://iabuilding.duckdns.org/api
```

`NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` is **no longer required** for login (may remove from Vercel).

**Redeploy** Vercel after saving secrets.

---

## 4. Local development

`apps/web/.env.local`:

```env
NEXT_PUBLIC_KEYCLOAK_URL=https://iabuilding.duckdns.org/auth
NEXT_PUBLIC_KEYCLOAK_REALM=construction-marketplace
NEXT_PUBLIC_API_URL=https://iabuilding.duckdns.org/api

KEYCLOAK_BFF_CLIENT_ID=platform-bff
KEYCLOAK_BFF_CLIENT_SECRET=<same secret as Vercel>
```

Never commit `.env.local` or put `KEYCLOAK_BFF_CLIENT_SECRET` in `NEXT_PUBLIC_*`.

---

## 5. Verify

1. Modal login on https://ant-eta-seven.vercel.app still works.
2. Direct token request with **public** client should **fail**:

```bash
curl -s -X POST "https://iabuilding.duckdns.org/auth/realms/construction-marketplace/protocol/openid-connect/token" \
  -d "grant_type=password" \
  -d "client_id=platform-web" \
  -d "username=testuser" \
  -d "password=wrong" \
  -d "scope=openid"
# Expected: unauthorized_client or invalid_client
```

3. Password grant with `platform-bff` + secret **only from your machine** (not in browser) should work for ops debugging.

---

## 6. Fresh installs (realm import)

New realms import `platform-bff` from  
[realm-construction-marketplace.json](../infra/keycloak/import/realm-construction-marketplace.json).  
Set the client secret manually in Admin → **Credentials** after first boot.

---

## Related

- [Auth — Keycloak](./auth-keycloak.md)
- [Deploy Web to Vercel](./deployment-vercel.md)
