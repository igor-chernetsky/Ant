# Email verification on signup

New accounts must verify their email via Keycloak before they can sign in.

---

## Flow

1. User submits **Create account** in the login modal.
2. BFF creates a Keycloak user with `VERIFY_EMAIL` required action.
3. Keycloak sends a verification email (SMTP must be configured).
4. User clicks the link in the email.
5. User returns to the app and signs in with email + password.

Until the email is verified, login returns: *Verify your email before signing in.*

Auto-repair on login **does not** bypass email verification.

---

## 1. Configure Keycloak SMTP

Keycloak Admin → **Realm settings** → **Email**

| Field | Example (Resend) |
|-------|------------------|
| Host | `smtp.resend.com` |
| Port | `587` |
| From | `noreply@builthai.com` |
| From display name | `BuilTHAI` |
| Enable SSL | off |
| Enable StartTLS | on |
| Authentication | on |
| Username | `resend` |
| Password | Resend API key (`re_…`) |

Click **Save**, then **Test connection**.

### Resend quick path

1. [Resend](https://resend.com) → **Domains** → Add `builthai.com`.
2. Add the DNS records Resend shows (DKIM / SPF / optionally DMARC) in Porkbun.
3. Wait until the domain is **Verified**.
4. **API Keys** → create a key; use it as `SMTP_PASSWORD` (username is always `resend`).
5. Set `SMTP_FROM` to an address on that domain, e.g. `noreply@builthai.com`.
6. In Resend, also verify you can send from `hello@builthai.com` (used for matching-project alerts, invites, admin broadcast). Set API `SMTP_BROADCAST_FROM=hello@builthai.com`.

Same SMTP vars are used by the Nest API (notifications) and the Next.js BFF (signup verification email).

### Deliverability (matching / invites)

Matching and “tender opened” emails are sent from `hello@` (not noreply), include **List-Unsubscribe** + one-click POST, and are throttled (~150 ms between recipients). Registry invites use mailto unsubscribe only and are capped (clients: 3/4/3 by kind; admins: 10/15/10).

**DNS (Porkbun / your DNS host)** — add exactly what Resend shows for `builthai.com`:

1. SPF (`TXT` / Resend SPF record)
2. DKIM (`TXT` records Resend provides)
3. DMARC (`TXT` at `_dmarc.builthai.com`), e.g. `v=DMARC1; p=none; rua=mailto:hello@builthai.com` then tighten later

**Ops checklist after deploy**

1. Confirm Resend domain status is **Verified**.
2. EC2 / API env: `SMTP_FROM=noreply@…`, `SMTP_BROADCAST_FROM=hello@…`, `SMTP_FROM_NAME=BuilTHAI`, `WEB_APP_URL=https://www.builthai.com`.
3. Optional: set `EMAIL_UNSUBSCRIBE_SECRET` (16+ chars); otherwise tokens use `SMTP_PASSWORD`.
4. Keycloak Email “From” must be the same verified domain (`noreply@builthai.com`).
5. Send a test matching alert and confirm headers show `From: hello@…` and `List-Unsubscribe`.
6. Click footer unsubscribe → `/email-unsubscribe` should turn off **Matching new projects** in Account.

---

## 2. Vercel environment variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Redirect after email verification, e.g. `https://www.builthai.com` |
| `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` | Already required for signup |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | Resend SMTP (see above) |
| `SKIP_EMAIL_VERIFICATION` | Set to `true` **only** in local dev without SMTP |

Add to Vercel project settings and redeploy.

---

## 3. Local development without SMTP

In `apps/web/.env.local`:

```env
SKIP_EMAIL_VERIFICATION=true
```

Users are created with `emailVerified: true` and signed in immediately (old behaviour).

---

## 4. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Signup: *verification email could not be sent* | Configure Keycloak SMTP **or** Vercel SMTP vars for app-sent verification; test connection |
| Login: *Verify your email* | User must click the link in the email |
| Forgot password: *temporarily unavailable* | Keycloak realm Email SMTP often unset. App fallback needs the same Vercel vars as verification: `EMAIL_VERIFICATION_SECRET` + `SMTP_*`. Check Vercel function logs for `[auth-keycloak] password reset`. |
| Email not received | Check spam; Resend dashboard logs; domain must be Verified; From must match domain |
| Link opens wrong site / `buildthai.com` in email | Fix **Vercel** `NEXT_PUBLIC_APP_URL` to `https://www.builthai.com` (not `buildthai.com`) and redeploy. On EC2 set `WEB_APP_URL` the same way. Code auto-corrects the typo at runtime, but update env anyway. |

---

## Related

- [auth-keycloak.md](./auth-keycloak.md) — realm and clients
- [auth-bff-client.md](./auth-bff-client.md) — BFF client secret
