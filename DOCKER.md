# golfnme — Docker Setup (PostgreSQL)

Containerized stack: Next.js app + BullMQ worker + PostgreSQL + Redis.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Network (internal)                 │
│                                                                  │
│  ┌──────────────┐   Socket.io    ┌──────────────┐               │
│  │   Next.js    │◄──────────────►│   Browser    │ (external)    │
│  │  app :3000   │                └──────────────┘               │
│  │  + server.ts │                                               │
│  └──────┬───────┘                                               │
│         │ BullMQ dispatch                                        │
│         ▼                                                        │
│  ┌──────────────┐   BullMQ      ┌──────────────┐               │
│  │    Redis     │◄─────────────►│    Worker    │               │
│  │    :6379     │               │  processors  │               │
│  └──────────────┘               └──────┬───────┘               │
│                                        │ Prisma                 │
│  ┌──────────────┐                      │                        │
│  │  PostgreSQL  │◄─────────────────────┘                        │
│  │    :5432     │◄── app (Prisma) ───────────────               │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Worker processors

| Processor | Queue | Trigger | What it does |
|---|---|---|---|
| `recompute-user-stats` | `stats` | Round completed/deleted | Rebuilds scoring averages, FIR%, GIR%, putts |
| `recompute-handicap` | `stats` | Round completed/deleted | WHS differential calc, updates `User.handicap` |
| `leaderboard-update` | `leaderboard` | Score submitted (300ms debounce) | Computes rankings, broadcasts via Socket.io |
| `session-timeout-check` | `session` | Session created/started | Auto-cancels stale lobbies (1h) and active rounds (8h) |
| `stale-session-cleanup` | `session` | Cron — every hour | Bulk sweep for any missed sessions |
| `send-notification` | `notification` | Friend requests, session events | Pushes to Ably `user:{id}` channel |

---

## Quick start

### 1. Environment

```bash
cp .env.example .env
# Edit .env — at minimum set NEXTAUTH_SECRET and POSTGRES_PASSWORD
openssl rand -base64 32   # paste into NEXTAUTH_SECRET
```

### 2. Dev (hot reload + pgAdmin + Bull Board)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| Bull Board | http://localhost:3001 |
| pgAdmin | http://localhost:8081 (admin@admin.com / admin) |

Connect pgAdmin to the `postgres` host on port `5432` using your `.env` credentials.

### 3. Run migrations (first time and after schema changes)

```bash
# Generate migration files from schema changes
docker compose exec app npx prisma migrate dev --name init

# Apply migrations in production
docker compose exec app npx prisma migrate deploy
```

### 4. Seed

```bash
docker compose exec app npx tsx prisma/seed.ts
```

### 5. Production

```bash
docker compose build
docker compose up -d
```

---

## Schema migration from MongoDB

All `@id @default(auto()) @map("_id") @db.ObjectId` fields are replaced with `@id @default(cuid())`. Foreign keys drop the `@db.ObjectId` annotation. The `Account`, `Session`, and `VerificationToken` models are added (required by `@auth/prisma-adapter` with SQL databases).

The `@@index` directives have been added throughout for the query patterns the app actually uses.

### NextAuth adapter

With PostgreSQL, `@auth/prisma-adapter` takes over OAuth account storage. The `auth.ts` configuration needs the adapter wired in:

```ts
// src/lib/auth.ts — add these two lines
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),  // add this
  session: { strategy: "jwt" },    // keep jwt for credentials provider
  // ... rest unchanged
});
```

### isValidObjectId → isValidCuid

`src/lib/isValidObjectId.ts` is replaced by `src/lib/isValidCuid.ts`.
`src/services/friend.service.ts` needs a one-line import change — see `friend.service.patch.ts`.

---

## File structure (new/changed files)

```
├── Dockerfile                         # + openssl for Prisma postgres engine
├── Dockerfile.worker                  # + openssl
├── docker-compose.yml                 # postgres instead of mongo
├── docker-compose.dev.yml             # pgAdmin instead of mongo-express
├── docker/
│   └── postgres/
│       └── init.sql                   # extensions + commented index templates
├── prisma/
│   └── schema.prisma                  # postgresql provider, cuid() IDs, Account/Session models
├── src/
│   ├── lib/
│   │   ├── isValidCuid.ts             # replaces isValidObjectId.ts
│   │   └── queue.ts                   # unchanged
│   ├── services/
│   │   └── friend.service.patch.ts    # 2-line diff — import + function name
│   └── app/api/health/route.ts        # postgres check instead of mongo ping
└── .env.example                       # postgresql:// DATABASE_URL
```

---

## Notes

- **openssl** is required in Alpine images for Prisma's PostgreSQL query engine. Both Dockerfiles include `apk add openssl`.
- **Migrations vs db push**: use `prisma migrate dev` in development (generates SQL migration files you can commit). Use `prisma migrate deploy` in CI/production. Avoid `prisma db push` in production — it bypasses migration history.
- **Connection pooling**: for production with multiple app replicas, add PgBouncer or use Prisma Accelerate to avoid exhausting Postgres connection limits.
- **Socket.io + worker**: the worker calls `emitToSession` / `emitLeaderboardUpdate` from `src/lib/socket.ts`. These are no-ops unless the Socket.io singleton is initialized. For multi-process reliability, swap to `@socket.io/redis-adapter` — the app subscribes to a Redis channel, the worker publishes to it.
