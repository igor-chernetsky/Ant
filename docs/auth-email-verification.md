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

| Field | Example (AWS SES) |
|-------|-------------------|
| Host | `email-smtp.eu-central-1.amazonaws.com` |
| Port | `587` |
| From | `noreply@yourdomain.com` |
| From display name | `Ant` |
| Enable SSL | off |
| Enable StartTLS | on |
| Authentication | on |
| Username | SES SMTP username |
| Password | SES SMTP password |

Click **Save**, then **Test connection**.

### AWS SES quick path

1. Verify domain or sender email in SES.
2. Create SMTP credentials (SES console → SMTP settings).
3. Ensure production access if sending to arbitrary addresses.
4. Use the regional SMTP endpoint for your bucket/API region.

---

## 2. Vercel environment variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Redirect after email verification, e.g. `https://ant-eta-seven.vercel.app` |
| `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` | Already required for signup |
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
| Signup: *verification email could not be sent* | Configure Keycloak SMTP; test connection in Admin |
| Login: *Verify your email* | User must click the link in the email |
| Email not received | Check spam; SES sandbox; From address verified |
| Link opens wrong site | Set `NEXT_PUBLIC_APP_URL` on Vercel |

---

## Related

- [auth-keycloak.md](./auth-keycloak.md) — realm and clients
- [auth-bff-client.md](./auth-bff-client.md) — BFF client secret
