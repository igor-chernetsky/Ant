# Platform Web (MVP)

Next.js client with **in-app login modal** (no redirect to Keycloak).  
Auth uses Vercel Route Handlers (BFF) + httpOnly cookie + **confidential** Keycloak client `platform-bff`.

## Local development

```bash
cd apps/web
cp .env.example .env.local
# Set KEYCLOAK_BFF_CLIENT_SECRET from Keycloak Admin
npm install
npm run dev
```

## Environment variables

| Variable | Scope | Example |
|----------|--------|---------|
| `NEXT_PUBLIC_KEYCLOAK_URL` | Public | `https://iabuilding.duckdns.org/auth` |
| `NEXT_PUBLIC_KEYCLOAK_REALM` | Public | `construction-marketplace` |
| `NEXT_PUBLIC_API_URL` | Public | `https://iabuilding.duckdns.org/api` |
| `KEYCLOAK_BFF_CLIENT_ID` | **Server only** | `platform-bff` |
| `KEYCLOAK_BFF_CLIENT_SECRET` | **Server only** | from Keycloak Credentials tab |

## Keycloak setup

See [docs/auth-bff-client.md](../../docs/auth-bff-client.md) — create `platform-bff`, disable Direct access grants on `platform-web` and `platform-api`.

## Deploy to Vercel

See [docs/deployment-vercel.md](../../docs/deployment-vercel.md).
