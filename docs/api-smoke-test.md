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

### Docker build: `ENOSPC: no space left on device`

EC2 trial disks fill up quickly (images, build cache, old containers).

```bash
df -h
docker system df

# Free space (safe for rebuild; does not remove named volumes like postgres_data)
docker builder prune -af
docker image prune -af
docker container prune -f
```

If still full, increase EBS volume in AWS or remove unused volumes manually (`docker volume ls`).

Then rebuild:

```bash
cd ~/construction-platform/infra
docker compose -f docker-compose.ec2.yml build --no-cache api
docker compose -f docker-compose.ec2.yml up -d api caddy
```

Ensure `apps/api/package-lock.json` is committed — the Dockerfile uses `npm ci`, not `npm install`.

The API image uses a **single-stage** Dockerfile to avoid running out of disk when copying `node_modules` between build stages on 8 GB EC2 instances. If build still fails with `no space left on device`, expand the EBS volume to 20 GB.

| Issue | Fix |
|-------|-----|
| 502 on `/api/*` | API container down or restarting — `docker compose logs api --tail=80` |
| API `Restarting (1)` | Usually bad `DATABASE_URL`, failed Prisma migrate, or missing `KEYCLOAK_*` env — see below |
| 401 Unauthorized | Token expired; check `KEYCLOAK_ISSUER` in api env matches token `iss` |
| 500 on `/v1/me` | `docker compose logs api` — often missing `users` table: `docker compose exec api npx prisma migrate deploy` |
| Connection refused | `docker compose ps` — api container must be Up |
| ERESOLVE during build | Usually disk full; free space and use `npm ci` via updated Dockerfile |
