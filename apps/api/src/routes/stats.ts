import { Hono } from "hono";
import { requireAuth, type AppEnv } from "@/middleware/auth";
import { statsService } from "@/services";

export const statsRoutes = new Hono<AppEnv>();

// ── GET /api/stats?type=overview|courses|trends|headtohead ────────────────
statsRoutes.get("/", requireAuth, async (c) => {
  try {
    const userId = c.get("user").id;
    const type = c.req.query("type");
    const courseId = c.req.query("courseId");
    const opponentId = c.req.query("opponentId");
    const periodDays = parseInt(c.req.query("period") || "90");

    if (type === "overview" || !type) {
      const data = await statsService.getOverviewStats(userId);
      return c.json({ success: true, data });
    }

    if (type === "courses") {
      const data = await statsService.getCourseStats(userId, courseId);
      return c.json({ success: true, data });
    }

    if (type === "trends") {
      const data = await statsService.getTrendStats(userId, periodDays);
      return c.json({ success: true, data });
    }

    if (type === "headtohead" && opponentId) {
      const data = await statsService.getHeadToHeadStats(userId, opponentId);

      if (!data) {
        return c.json({
          success: true,
          data: {
            opponentId,
            opponentName: "Unknown",
            wins: 0,
            losses: 0,
            ties: 0,
            averageMargin: 0,
            lastMatchup: null,
            sharedRounds: [],
          },
        });
      }

      return c.json({ success: true, data });
    }

    return c.json({ error: "Invalid stats type" }, 400);
  } catch (error) {
    console.error("Error fetching stats:", error);
    return c.json({ error: "Failed to fetch stats" }, 500);
  }
});
