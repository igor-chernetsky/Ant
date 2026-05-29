# Deploy Web App to Vercel

Minimal Next.js frontend that signs in via Keycloak and calls `GET /api/v1/me` on EC2.

**Prerequisites:** API and Keycloak running at `https://iabuilding.duckdns.org` (see [deployment-ec2-keycloak.md](./deployment-ec2-keycloak.md)).

---

## 1. Vercel project settings

| Setting | Value |
|---------|--------|
| Framework Preset | **Next.js** (not Other / Static) |
| Root Directory | `apps/web` |
| Build Command | *(leave default)* `npm run build` |
| Output Directory | **leave empty** — do NOT set `public` |
| Install Command | *(default)* `npm install` |

> **Important:** If Output Directory is set to `public`, the deploy fails with  
> `No Output Directory named "public" found`. Clear that field — Next.js uses `.next`, not `public` as build output.

The repo includes `apps/web/vercel.json` with `"framework": "nextjs"`.

## 2. Environment variables

Add in Vercel → Project → Settings → Environment Variables (Production **and** Preview):

```env
NEXT_PUBLIC_KEYCLOAK_URL=https://iabuilding.duckdns.org/auth
NEXT_PUBLIC_KEYCLOAK_REALM=construction-marketplace
NEXT_PUBLIC_API_URL=https://iabuilding.duckdns.org/api

KEYCLOAK_BFF_CLIENT_ID=platform-bff
KEYCLOAK_BFF_CLIENT_SECRET=<from Keycloak platform-bff Credentials tab>
```

Redeploy after changing env vars. **Never** put `KEYCLOAK_BFF_CLIENT_SECRET` in a `NEXT_PUBLIC_*` variable.

---

## 3. Keycloak — confidential BFF client

Modal login uses **password grant only on the server** via client `platform-bff` (confidential).

Full steps: [auth-bff-client.md](./auth-bff-client.md)

Summary:

| Client | Direct access grants |
|--------|----------------------|
| `platform-bff` | **ON** (confidential + secret on Vercel) |
| `platform-web` | **OFF** |
| `platform-api` | **OFF** |

---

## 4. Verify

1. Open Vercel URL in browser.
2. Guest content loads without sign-in.
3. Click **Sign in** → modal → enter Keycloak user credentials.
4. Profile block appears (JSON from `/v1/me` via BFF).

---

## 5. Troubleshooting

| Issue | Fix |
|-------|-----|
| `No Output Directory named "public" found` | Vercel → Settings → Build → **clear Output Directory**; Framework = **Next.js**; Root = `apps/web` |
| `Authentication service is not configured` | Set `KEYCLOAK_BFF_CLIENT_SECRET` on Vercel and redeploy |
| `Invalid username or password` | Check user password; verify `platform-bff` secret and Direct access grants on BFF only |
| CORS / blocked fetch | API uses `origin: true`; check browser network tab |
| 401 on `/v1/me` | Token issue — [api-smoke-test.md](./api-smoke-test.md) |
| Blank page / config error | Set `NEXT_PUBLIC_*` and BFF secrets; see [auth-bff-client.md](./auth-bff-client.md) |

---

## Architecture

```mermaid
flowchart LR
  Browser --> Vercel[Next.js on Vercel]
  Browser --> KC[Keycloak EC2 /auth]
  Browser --> API[NestJS EC2 /api]
  Vercel -->|platform-bff + secret| KC
  Browser -->|cookie session| Vercel
  Vercel -->|Bearer JWT| API
```
