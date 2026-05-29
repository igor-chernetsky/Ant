# Platform Web (MVP)

Next.js client for Keycloak login (PKCE) and `GET /api/v1/me`.

## Local development

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

## Environment variables

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_KEYCLOAK_URL` | `https://iabuilding.duckdns.org/auth` |
| `NEXT_PUBLIC_KEYCLOAK_REALM` | `construction-marketplace` |
| `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` | `platform-web` |
| `NEXT_PUBLIC_API_URL` | `https://iabuilding.duckdns.org/api` |

## Keycloak setup (required before login works)

Realm: `construction-marketplace`  
Client: `platform-web`

1. **Valid redirect URIs** — add:
   - `http://localhost:3000/*`
   - `https://YOUR-APP.vercel.app/*`
   - `https://YOUR-APP-*.vercel.app/*` (preview deployments, if supported by your Keycloak version)

2. **Web origins** — add the same origins (without `/*`):
   - `http://localhost:3000`
   - `https://YOUR-APP.vercel.app`

3. **Client authentication**: Off (public client)

4. **Standard flow**: Enabled

5. **PKCE**: S256 (already in realm import)

## Deploy to Vercel

1. Push repo to GitHub.
2. Vercel → **Add Project** → import repo.
3. Set **Root Directory** to `apps/web`.
4. Add the four `NEXT_PUBLIC_*` environment variables (Production + Preview).
5. Deploy.
6. Add the Vercel URL to Keycloak `platform-web` redirect URIs and web origins.

See [docs/deployment-vercel.md](../../docs/deployment-vercel.md).
