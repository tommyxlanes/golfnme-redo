import { Hono } from "hono";
import { cors } from "hono/cors";
import * as Sentry from "@sentry/node";
import { ablyRoutes } from "@/routes/ably";
import { authRoutes } from "@/routes/auth";
import { avatarRoutes, userAvatarRoutes } from "@/routes/avatars";
import { courseRoutes } from "@/routes/courses";
import { friendRoutes } from "@/routes/friends";
import { healthRoutes } from "@/routes/health";
import { notificationRoutes } from "@/routes/notifications";
import { roundRoutes } from "@/routes/rounds";
import { scoreRoutes } from "@/routes/scores";
import { sessionRoutes } from "@/routes/sessions";
import { statsRoutes } from "@/routes/stats";
import { userRoutes } from "@/routes/user";

export const app = new Hono();

// Auth is a Bearer header, never a cookie, so any origin may call the API.
// Set CORS_ORIGINS (comma-separated) to restrict browser clients; native
// apps are not subject to CORS either way.
const corsOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  "/api/*",
  cors({
    origin: corsOrigins.length > 0 ? corsOrigins : "*",
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    maxAge: 86400,
  }),
);

// Paths are unchanged from the old Next.js routes, so existing clients only
// need a new base URL.
const api = new Hono()
  .route("/health", healthRoutes)
  .route("/auth", authRoutes)
  .route("/ably-token", ablyRoutes)
  .route("/avatars", avatarRoutes)
  .route("/courses", courseRoutes)
  .route("/friends", friendRoutes)
  .route("/notifications", notificationRoutes)
  .route("/rounds", roundRoutes)
  .route("/scores", scoreRoutes)
  .route("/sessions", sessionRoutes)
  .route("/stats", statsRoutes)
  .route("/user/avatar", userAvatarRoutes)
  .route("/user", userRoutes);

app.route("/api", api);

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  // Malformed JSON bodies are the client's fault, not ours.
  if (err instanceof SyntaxError) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  console.error(`[api] ${c.req.method} ${c.req.path}`, err);
  Sentry.captureException(err);
  return c.json({ error: "Internal server error" }, 500);
});
