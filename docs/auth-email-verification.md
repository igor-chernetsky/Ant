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

Same SMTP vars are used by the Nest API (notifications) and the Next.js BFF (signup verification email).

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
| Email not received | Check spam; Resend dashboard logs; domain must be Verified; From must match domain |
| Link opens wrong site | Set `NEXT_PUBLIC_APP_URL` / `WEB_APP_URL` to `https://www.builthai.com` |

---

## Related

- [auth-keycloak.md](./auth-keycloak.md) — realm and clients
- [auth-bff-client.md](./auth-bff-client.md) — BFF client secret
