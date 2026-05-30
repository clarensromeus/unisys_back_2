# University ERP Backend

Production-shaped NestJS API for the University ERP frontend.

## Stack

- NestJS with feature modules
- Prisma ORM with PostgreSQL
- Redis for dashboard caching, auth rate limiting, and token blacklist
- JWT access and refresh tokens
- RBAC guards
- Swagger docs

## Run Locally

```bash
cp .env.example .env
npm install
docker compose up -d
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

API base URL: `http://localhost:4000/api/v1`

Swagger: `http://localhost:4000/api/docs`

Seed credentials:

- `admin@northbridge.edu`
- `Password123!`

## Response Shape

All successful responses are wrapped as:

```json
{ "success": true, "data": {}, "message": "OK" }
```

Errors are normalized as:

```json
{ "success": false, "error": "message" }
```
