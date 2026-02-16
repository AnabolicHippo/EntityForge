# Entity Forge Backend

Phase 1 backend scaffold for Entity Forge using Express + Prisma + PostgreSQL (pgvector-ready) with Supabase JWT auth.

## Included In This Scaffold

- Node.js project initialized in ES module mode (`type: module`)
- Prisma schema for:
  - `users`
  - `workspaces`
  - `entities` (with vector embedding column)
  - `workflows`
  - `entity_versions`
  - `chat_messages`
  - `embedding_queue`
- Supabase JWT verification middleware (`middleware/auth.js`)
- Express server (`src/server.js`) with:
  - CORS middleware
  - Entity CRUD endpoints
  - Vector similarity endpoint (`GET /api/entities/similar`)
  - Workflow endpoints (`POST`, `GET`, `GET/:id`, `PUT/:id`)

## Prerequisites

- Node.js 20+
- PostgreSQL 15+ (with `pgvector` extension available)
- Supabase project (for auth)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create local environment config:

```bash
cp .env.example .env
```

3. Fill required values in `.env`:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `OPENAI_API_KEY` (required for `/api/entities/similar`)

4. Generate Prisma client (safe to run before migrations):

```bash
npm run prisma:generate
```

5. Start the API server:

```bash
npm run dev
```

Health check:

```bash
GET /health
```

## API Endpoints (Phase 1)

### Entities

- `POST /api/entities`
- `GET /api/entities`
- `GET /api/entities/:id`
- `PUT /api/entities/:id`
- `DELETE /api/entities/:id`
- `GET /api/entities/similar`

### Workflows

- `POST /api/workflows`
- `GET /api/workflows`
- `GET /api/workflows/:id`
- `PUT /api/workflows/:id`

All `/api/*` endpoints require:

```http
Authorization: Bearer <JWT>
```

## Important Phase Constraint

Per PRD Phase 1 requirements, this scaffold intentionally does **not**:

- run Prisma migrations,
- deploy services,
- add embedding worker implementation,
- add chat endpoints.

## Notes On Vector Fields

Prisma does not natively model pgvector as a first-class scalar, so vector columns are represented as:

- `Unsupported("vector(1536)")`

Vector similarity operations are implemented with raw SQL (`$queryRaw`) in the API.
