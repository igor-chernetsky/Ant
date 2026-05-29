# Platform API (MVP)

NestJS API with Keycloak JWT validation and `GET /v1/me`.

## Endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | No |
| GET | `/v1/me` | Bearer JWT |

Public URLs (via Caddy):

- `https://iabuilding.duckdns.org/api/health`
- `https://iabuilding.duckdns.org/api/v1/me`

## Local development

```bash
cd apps/api
cp .env.example .env
npm install
npx prisma migrate dev
npm run start:dev
```

## Environment

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `KEYCLOAK_ISSUER` | e.g. `https://iabuilding.duckdns.org/auth/realms/construction-marketplace` |
| `KEYCLOAK_JWKS_URI` | JWKS URL (can use internal Keycloak URL in Docker) |
| `PORT` | Default `3000` |
