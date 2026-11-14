import { Hono } from "hono";
import { getAblyRest } from "@/lib/ably";
import { requireAuth, type AppEnv } from "@/middleware/auth";

export const ablyRoutes = new Hono<AppEnv>();

// ── GET /api/ably-token ───────────────────────────────────────────────────
// Ably token request for the signed-in user (use as the client's authUrl).
ablyRoutes.get("/", requireAuth, async (c) => {
  try {
    if (!process.env.ABLY_API_KEY) {
      console.error("ABLY_API_KEY is not configured");
      return c.json({ error: "Server configuration error" }, 500);
    }

    const userId = c.get("user").id;
    const tokenRequest = await getAblyRest().auth.createTokenRequest({
      clientId: userId,
      capability: {
        // Allow publish/subscribe to session channels
        "session:*": ["publish", "subscribe", "presence"],
        // Listen (only) on their own notification channel
        [`user:${userId}`]: ["subscribe"],
      },
    });

    return c.json(tokenRequest);
  } catch (error) {
    console.error("Ably token error:", error);
    return c.json({ error: "Failed to generate token" }, 500);
  }
});
