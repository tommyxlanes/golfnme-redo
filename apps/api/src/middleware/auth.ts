import { createMiddleware } from "hono/factory";
import { verifyAccessToken, type AuthUser } from "@/lib/jwt";

export type AppEnv = {
  Variables: {
    user: AuthUser;
  };
};

// Every client (web proxy, Expo app) authenticates the same way:
//   Authorization: Bearer <access token from /api/auth/login>
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  const user = token ? await verifyAccessToken(token) : null;

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", user);
  await next();
});
