# Authentication — Keycloak (MVP)

The MVP uses **self-hosted Keycloak** on EC2. The NestJS API validates JWT access tokens issued by Keycloak; it does not implement password login itself.

---

## 1. Flow Overview

```mermaid
sequenceDiagram
  participant Browser
  participant BFF as Next.js BFF
  participant KC as Keycloak
  participant API as NestJS API

  Browser->>BFF: POST /api/auth/login (modal)
  BFF->>KC: password grant (platform-bff + secret)
  KC->>BFF: access_token
  BFF->>Browser: httpOnly cookie
  Browser->>BFF: GET /api/auth/me
  BFF->>API: Bearer token
  API->>Browser: profile JSON
```

---

## 2. Realm and Clients

| Client | Type | Direct access | Purpose |
|--------|------|---------------|---------|
| `platform-bff` | Confidential | ON | Vercel server login only |
| `platform-web` | Public | OFF | Future OIDC / PKCE |
| `platform-api` | Public | OFF | JWT audience reference |

See [auth-bff-client.md](./auth-bff-client.md) for setup.

---

## 3. Roles

Realm roles (in JWT `realm_access.roles`):

- `client` — project owner
- `contractor` — bid/tender participant
- `designer` — design tender path
- `admin` — platform admin
- `support` — support agent

NestJS guards check roles after JWT validation. Business permissions (e.g. own project only) are enforced in application services.

### Creating a project

The create-project form and the whole pre-tender workspace are open to everyone,
including guests. The account is asked for at the **publish** step:

| Viewer | What happens |
|--------|--------------|
| Guest | `POST /api/guest/projects` creates the project with `clientId = null`, stores the returned token in the httpOnly `ant_guest_project` cookie, and opens `/projects/:id`. The visitor answers the intake, uploads documents and sees the estimate. "Publish for bids" shows a registration dialog; registering claims the draft in place and the tender controls appear. |
| Signed in without `client` | `BecomeRoleModal` offers the client role (accepting the Client Agreement). On success the project is created right away. |
| Signed in with `client` | The project is created immediately. |

**Guest authorization.** `POST /v1/guest/projects` issues a random token; the API
stores only its SHA-256 (`Project.guestTokenHash`) and the 24-hour deadline
(`guestExpiresAt`). `GuestProjectGuard` authorizes `/v1/guest/projects/:id/**`
against the `x-ant-guest-token` header. The BFF rewrites the shared
`/v1/projects/:id/**` routes onto that namespace when there is no session but the
browser holds the token, so the client code needs no guest-specific paths.
Sub-resources the guest API does not implement (tenders, contracts, amendments,
progress, estimate refinement) return 404 — that is the boundary.

**Claim.** Two paths, both idempotent:

1. *Cookie.* `POST /v1/projects/:id/claim` (JWT + guest token) sets `clientId` and
   clears the guest credentials, but only for an unclaimed project.
   `POST /api/projects/:id/claim` does this on the BFF side and drops the cookie.
2. *Email.* The cookie alone lost the draft: confirming the address on a phone,
   or clearing cookies, left the visitor with no way back and the 24-hour cleanup
   eventually deleted the project. So `/api/auth/signup` and `/api/auth/login`
   call `POST /v1/guest/projects/:id/claim-email` for every draft in the browser
   and store the registering address in `Project.guestClaimEmail`. The next
   authenticated visit — `GET /v1/projects` (list) or `GET /v1/projects/:id` —
   hands those projects to the account
   (`ProjectsService.claimGuestProjectsByEmail`, one indexed `updateMany`), so the
   draft shows up under "my projects" on any device. Tagging also moves
   `guestExpiresAt` out to 7 days (`GUEST_PROJECT_CLAIM_TTL_MS`), because
   confirming an email can take days.

   Trust: only a browser holding the guest token can set the address, and claiming
   requires a session for an account with exactly that address. With email
   verification enabled a session implies a confirmed mailbox, so the project can
   only be picked up by whoever proved they own it. If the realm ever runs without
   verification (or `SKIP_EMAIL_VERIFICATION=true`), the claim is only as strong as
   signup itself — anyone could register the address they typed at signup.

**Cost controls.** One client IP may start 3 anonymous projects per day
(`GuestProjectQuotaService`, in-memory), a guest project gets at most 8
AI-authored intake questions (`GUEST_AI_QUESTION_LIMIT`) before the
deterministic question set takes over, and the final summary/estimate stays AI
driven once per project.

**Cleanup.** `GuestProjectCleanupService` runs hourly and deletes unclaimed
projects past `guestExpiresAt` together with their documents and S3 objects.
Projects tagged with an email get the longer deadline; claimed ones have no
deadline at all.

`POST /v1/projects` enforces `@Roles('client')` (`projects.controller.ts`), so
the dialogs cannot be bypassed with a direct API call.

---

## 4. Local User Sync

Keycloak holds authentication; PostgreSQL holds profile and business data.

On first authenticated request:
1. Validate JWT.
2. Upsert `users` by `keycloak_sub` (claim `sub`).
3. Copy email, name from token claims.

Optional: Keycloak **Event Listener** or webhook for registration → create org stub.

---

## 5. NestJS Integration (Target)

```typescript
// Guard validates JWT via JWKS
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('contractor')
@Post('tenders/:id/bids')
submitBid() { ... }
```

Libraries:
- `passport-jwt` + `jwks-rsa`, or
- `@nestjs/passport` with custom strategy fetching JWKS from:

```
${KEYCLOAK_ISSUER}/protocol/openid-connect/certs
```

Validation checks:
- Signature (RS256)
- `iss` === `KEYCLOAK_ISSUER`
- `exp` not expired
- Optional: `aud` or `azp` for client binding

---

## 6. Environment Variables

| Variable | Example |
|----------|---------|
| `KEYCLOAK_ISSUER` | `http://EC2_IP/auth/realms/construction-marketplace` |
| `KEYCLOAK_JWKS_URI` | `.../protocol/openid-connect/certs` |
| `KEYCLOAK_REALM` | `construction-marketplace` |

Internal container fetch (optional):
`http://keycloak:8080/auth/realms/construction-marketplace/...`

Public issuer in tokens must match what browsers use.

---

## 7. Keycloak Behind Caddy

| Setting | Value |
|---------|-------|
| `KC_HTTP_RELATIVE_PATH` | `/auth` |
| `KC_PROXY_HEADERS` | `xforwarded` |
| `KC_HOSTNAME` | public host (IP or domain) |

Caddy proxies `/auth*` to Keycloak **without** stripping the prefix.

---

## 8. What to Defer Post-MVP

- Social login (Google, Apple)
- MFA / TOTP (enable in realm when needed)
- Organizations mapper (Keycloak groups → org_id claim)
- Central admin SSO

---

## 9. Switching to Auth0/Clerk Later

Keep `users.keycloak_sub` or rename to `external_id`. Migration:
1. Export users from Keycloak.
2. Import to new IdP or use federated link.
3. Update `KEYCLOAK_ISSUER` / JWKS URL in API.
4. Update web OIDC client config.

Application authorization logic stays unchanged if JWT shape (sub, email, roles) is preserved.
