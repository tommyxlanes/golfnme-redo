import { Hono } from "hono";
import { z } from "zod";
import { dispatchLeaderboardUpdate } from "@/lib/queue";
import { requireAuth, type AppEnv } from "@/middleware/auth";
import { scoreService } from "@/services";

export const scoreRoutes = new Hono<AppEnv>();

scoreRoutes.use(requireAuth);

const updateScoreSchema = z.object({
  roundId: z.string(),
  holeId: z.string(),
  strokes: z.number().int().min(1).max(20),
  putts: z.number().int().min(0).max(10).optional(),
  fairwayHit: z.boolean().optional(),
  greenInReg: z.boolean().optional(),
  penalties: z.number().int().min(0).default(0),
  holeNumber: z.number().int().min(1).max(18).optional(),
});

// ── POST /api/scores ──────────────────────────────────────────────────────
scoreRoutes.post("/", async (c) => {
  try {
    const userId = c.get("user").id;
    const validation = updateScoreSchema.safeParse(await c.req.json());
    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }
    const result = await scoreService.saveScore({
      userId,
      ...validation.data,
    });
    if (!result.success) {
      const status =
        result.error === "Round not found"
          ? 404
          : result.error === "Not your round"
            ? 403
            : 400;
      return c.json({ error: result.error }, status);
    }
    // Debounced leaderboard update for group sessions
    if ((result.score as any)?.round?.sessionId) {
      await dispatchLeaderboardUpdate(
        (result.score as any).round.sessionId,
        userId,
        validation.data.holeNumber ?? 0,
      );
    }
    return c.json({
      success: true,
      data: { score: result.score, roundTotals: result.roundTotals },
    });
  } catch (error) {
    console.error("Error updating score:", error);
    return c.json({ error: "Failed to update score" }, 500);
  }
});

// ── GET /api/scores?roundId=... ───────────────────────────────────────────
scoreRoutes.get("/", async (c) => {
  try {
    const roundId = c.req.query("roundId");
    if (!roundId) {
      return c.json({ error: "Round ID required" }, 400);
    }
    const result = await scoreService.getScoresForRound(
      roundId,
      c.get("user").id,
    );
    if (!result.success) {
      const status =
        result.error === "Round not found"
          ? 404
          : result.error === "Access denied"
            ? 403
            : 400;
      return c.json({ error: result.error }, status);
    }
    return c.json({ success: true, data: result.scores });
  } catch (error) {
    console.error("Error fetching scores:", error);
    return c.json({ error: "Failed to fetch scores" }, 500);
  }
});
