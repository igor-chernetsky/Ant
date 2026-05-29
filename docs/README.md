# Technical Documentation

Documentation for implementing the Construction Marketplace Platform.

| Document | Description |
|----------|-------------|
| [PDD](../PDD.md) | Product definition, scope, and requirements |
| [Backend Architecture — MVP](./backend-architecture-mvp.md) | Modular monolith design, modules, APIs, jobs |
| [Deployment — MVP](./deployment-mvp.md) | Vercel vs AWS, ECS/Fargate, environments, CI/CD |
| [Deployment — EC2 + Keycloak](./deployment-ec2-keycloak.md) | Single EC2 trial setup with Docker Compose |
| [Auth — Keycloak](./auth-keycloak.md) | OIDC flows, roles, NestJS JWT validation |
| [API Smoke Test](./api-smoke-test.md) | Verify `/api/health` and `/api/v1/me` on EC2 |
| [Deploy Web to Vercel](./deployment-vercel.md) | Next.js + Keycloak modal login |
| [CI/CD — EC2](./cicd-ec2.md) | GitHub Actions deploy on push to main |
| [Domain State Machines](./domain-state-machines.md) | Project, tender, bid, contract lifecycles |

## Recommended stack (summary)

- **Frontend:** Next.js on Vercel, React Native for mobile
- **Backend:** NestJS (API + worker), PostgreSQL, Redis, S3
- **Deploy (PoC):** Single EC2 + Docker Compose + Keycloak ([guide](./deployment-ec2-keycloak.md))
- **Deploy (production target):** Vercel (web) + AWS ECS Fargate + RDS + ElastiCache

See [Deployment — MVP](./deployment-mvp.md) for the full rationale.

## Implementation order

1. Identity, projects, media
2. AI intake and brief schema
3. Estimation
4. Tendering
5. Contracts
6. Messaging, progress, WebSocket
7. Reviews, support, notifications
