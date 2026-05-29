# API Smoke Test (EC2)

After `docker compose -f docker-compose.ec2.yml up -d --build`.

## 1. Health (no auth)

```bash
curl -s https://iabuilding.duckdns.org/api/health
```

Expected: `{"status":"ok"}`

## 2. Get an access token

### Option A — Keycloak Admin CLI inside container

```bash
docker compose -f docker-compose.ec2.yml exec keycloak \
  /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080/auth \
  --realm master \
  --user "$KEYCLOAK_ADMIN" \
  --password "$KEYCLOAK_ADMIN_PASSWORD"

docker compose -f docker-compose.ec2.yml exec keycloak \
  /opt/keycloak/bin/kcadm.sh create users -r construction-marketplace \
  -s username=testuser -s enabled=true -s email=test@example.com

# Set password (replace USER_ID from previous command output or users list)
```

### Option B — Enable password grant on client (trial only)

In Keycloak Admin → realm `construction-marketplace` → Clients → `platform-api` → enable **Direct access grants**.

```bash
curl -s -X POST "https://iabuilding.duckdns.org/auth/realms/construction-marketplace/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=platform-api" \
  -d "username=testuser" \
  -d "password=YOUR_PASSWORD"
```

Copy `access_token` from JSON.

## 3. Call /v1/me

```bash
curl -s https://iabuilding.duckdns.org/api/v1/me \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

Expected: user object with `id`, `email`, `roles`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 502 on `/api/*` | `docker compose logs api` — migration or startup error |
| 401 Unauthorized | Token expired; check `KEYCLOAK_ISSUER` in api env matches token `iss` |
| Connection refused | `docker compose ps` — api container must be Up |
