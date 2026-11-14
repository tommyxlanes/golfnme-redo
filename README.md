# golfnme

Golf score tracker: solo rounds, live group sessions, stats and friends.

```
apps/
  api/        Standalone REST API (Hono + Prisma + BullMQ worker). Owns the database.
  web/        Next.js UI. No database access — proxies /api/* to the API.
packages/
  shared/     Types + golf helpers (scoring, handicap) with no platform dependencies.
```

The Expo app is a third client of `apps/api`, alongside `apps/web`.

## Run it

One `.env` at the repo root is shared by everything.

```bash
npm install
npm run db:migrate     # apply migrations
npm run dev            # api :4000, web :3000, worker
```

| Script | What |
|---|---|
| `npm run dev:api` / `dev:web` / `worker:watch` | One process at a time |
| `npm run typecheck` | `tsc --noEmit` in every workspace |
| `npm run db:studio` / `db:seed` / `db:push` | Prisma, run inside `apps/api` |

Docker: see [DOCKER.md](DOCKER.md).

### Environment

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL`, `REDIS_URL` | api, worker | |
| `JWT_SECRET` | api | Signs Bearer tokens. Falls back to `NEXTAUTH_SECRET`. |
| `API_PORT` | api | Default `4000`. |
| `CORS_ORIGINS` | api | Comma-separated. Default: any origin (auth is a header, not a cookie). |
| `GOOGLE_CLIENT_ID` | api, web | Web OAuth client. |
| `GOOGLE_CLIENT_IDS` | api | Extra comma-separated client IDs (iOS / Android) accepted by `/api/auth/google`. |
| `GOLF_COURSE_API_KEY`, `ABLY_API_KEY`, `SENTRY_DSN` | api, worker | |
| `GCS_BUCKET_NAME`, `GCS_KEY_JSON` | api | Avatar storage. `GCS_KEY_JSON` is the whole service-account key file as one JSON string. Without both, avatar upload answers 503. |
| `GCS_EMULATOR_HOST` | api | Optional: a local GCS emulator (e.g. `http://localhost:4443`) instead of a real bucket. |
| `API_URL` | web | Where the API lives. Default `http://localhost:4000`. |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_SECRET` | web | Browser sign-in flow only. |

## API

Base URL `http://localhost:4000`. JSON in, JSON out. Paths are the same ones
the Next.js app used to serve, so a client only needs a new base URL.

### Auth

Every endpoint except the ones marked *public* needs:

```
Authorization: Bearer <token>
```

Tokens come from the sign-in endpoints, last 30 days, and are stateless —
"logout" is the client deleting its copy.

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/auth/login` *public* | `{ email, password }` | `{ token, user }` |
| POST | `/api/auth/signup` *public* | `{ name, email, username, password }` | `{ token, user }` |
| POST | `/api/auth/google` *public* | `{ idToken }` (Google ID token) | `{ token, user }` |
| POST | `/api/auth/register` *public* | `{ name, email, username, password }` | `{ success, user }` (no token) |
| GET | `/api/auth/me` | | `{ user }` |
| POST | `/api/auth/logout` | | `{ success }` |

`/api/auth/mobile/{login,signup,me,logout}` are aliases for the above.
Login is limited to 5 attempts / 15 min per IP, signup and register to 3 / hour.

### Resources

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` *public* | Postgres + Redis check |
| GET | `/api/courses?search=&limit=` *public* | Local courses |
| GET | `/api/courses/search?q=` *public* | Golf Course API lookup (cached 10 min) |
| POST | `/api/courses` | Create course |
| POST | `/api/courses/import` | `{ golfApiId, teePreference? }` |
| PATCH / PUT | `/api/courses/:id/holes` | One hole / bulk upsert |
| GET / POST | `/api/rounds` | List (`courseId`, `status`, `limit`, `offset`) / create |
| GET / PATCH / DELETE | `/api/rounds/:id` | PATCH `{ status: "COMPLETED" \| "ABANDONED" }` or `{ notes, weather }` |
| GET / POST | `/api/scores` | GET `?roundId=`; POST saves one hole |
| GET / POST / PATCH | `/api/sessions` | GET `?inviteCode=`; POST creates or joins; PATCH `{ sessionId, action }` |
| GET / POST / DELETE | `/api/sessions/:id/chat` | GET `?since=` for polling |
| GET / POST / PATCH / DELETE | `/api/friends` | GET `?type=requests\|pending` |
| GET | `/api/friends/search?query=` | |
| GET / PATCH / DELETE | `/api/notifications` | |
| GET | `/api/stats?type=overview\|courses\|trends\|headtohead` | |
| GET / PATCH | `/api/user/profile` | |
| POST / DELETE | `/api/user/avatar` | POST is `multipart/form-data` with the image in `avatar` (JPEG, PNG or WebP, 5 MB max); returns `{ avatarUrl }` |
| GET | `/api/avatars/:userId/:file` *public* | Serves an uploaded avatar. `avatarUrl` values are these paths, relative to the API |
| GET | `/api/ably-token` | Ably token request, fetched with the Bearer header. Grants the `session:*` channels plus subscribe on the user's own `user:<id>` notification channel |

Route handlers live in [apps/api/src/routes](apps/api/src/routes); request
schemas (zod) sit next to each handler.

### From the Expo app

```ts
const API = process.env.EXPO_PUBLIC_API_URL; // e.g. http://<lan-ip>:4000

const { token, user } = await fetch(`${API}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
}).then((r) => r.json());

await fetch(`${API}/api/rounds`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

Google sign-in has two routes:

- **Native** (recommended): get an ID token from Google Sign-In on the device
  and POST it to `/api/auth/google`. Add the iOS / Android client IDs to
  `GOOGLE_CLIENT_IDS`.
- **Browser hand-off** (what the app does today): open the web app's
  `/login?callbackUrl=<web>/api/auth/mobile/callback`; it deep-links back
  with `golfnme://auth?token=…`. This one needs the **web** host, not the API.

## How the web app uses the API

NextAuth still runs the browser sign-in, but it has no database adapter:
the Credentials provider calls `/api/auth/login`, Google sign-in exchanges
the ID token at `/api/auth/google`, and the returned API token is kept in the
encrypted session cookie. [apps/web/src/lib/api-proxy.ts](apps/web/src/lib/api-proxy.ts)
forwards the UI's `/api/*` calls to the API with that token attached, so page
code is unchanged.
