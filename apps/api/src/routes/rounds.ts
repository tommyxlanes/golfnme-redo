import { Hono } from "hono";
import { z } from "zod";
import {
  dispatchStatsRecompute,
  dispatchHandicapRecompute,
  dispatchLeaderboardUpdate,
} from "@/lib/queue";
import { requireAuth, type AppEnv } from "@/middleware/auth";
import { roundService } from "@/services";

export const roundRoutes = new Hono<AppEnv>();

roundRoutes.use(requireAuth);

// ── GET /api/rounds ───────────────────────────────────────────────────────
roundRoutes.get("/", async (c) => {
  try {
    const result = await roundService.getUserRounds(c.get("user").id, {
      courseId: c.req.query("courseId"),
      status: c.req.query("status") as any,
      take: parseInt(c.req.query("limit") || "20"),
      skip: parseInt(c.req.query("offset") || "0"),
    });

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ success: true, ...result.data });
  } catch (error) {
    console.error("Error fetching rounds:", error);
    return c.json({ error: "Failed to fetch rounds" }, 500);
  }
});

// ── POST /api/rounds ──────────────────────────────────────────────────────
const createRoundSchema = z.object({
  courseId: z.string(),
  sessionId: z.string().optional(),
  weather: z.string().optional(),
  notes: z.string().optional(),
});

roundRoutes.post("/", async (c) => {
  try {
    const validation = createRoundSchema.safeParse(await c.req.json());

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    const result = await roundService.createRound({
      userId: c.get("user").id,
      ...validation.data,
    });

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ success: true, data: result.round });
  } catch (error) {
    console.error("Error creating round:", error);
    return c.json({ error: "Failed to create round" }, 500);
  }
});

// ── GET /api/rounds/:id ───────────────────────────────────────────────────
roundRoutes.get("/:id", async (c) => {
  try {
    const result = await roundService.getRound(
      c.req.param("id"),
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
    return c.json({ success: true, data: result.data });
  } catch (error) {
    console.error("Error fetching round:", error);
    return c.json({ error: "Failed to fetch round" }, 500);
  }
});

// ── PATCH /api/rounds/:id ─────────────────────────────────────────────────
// Body: { status: "COMPLETED" | "ABANDONED" } or { notes, weather }
roundRoutes.patch("/:id", async (c) => {
  try {
    const userId = c.get("user").id;
    const id = c.req.param("id");
    const body = await c.req.json();
    let result;

    if (body.status === "COMPLETED") {
      result = await roundService.completeRound(id, userId);
      if (result.success) {
        // Recompute stats + handicap for this user
        await Promise.all([
          dispatchStatsRecompute(userId),
          dispatchHandicapRecompute(userId),
        ]);
        // Update session leaderboard if this is a group round
        if (result.round?.sessionId) {
          await dispatchLeaderboardUpdate(
            result.round.sessionId,
            userId,
            result.round.scores?.length ?? 18,
          );
        }
      }
    } else if (body.status === "ABANDONED") {
      result = await roundService.abandonRound(id, userId);
      if (result.success) {
        await dispatchStatsRecompute(userId);
      }
    } else {
      result = await roundService.updateRound(id, userId, {
        notes: body.notes,
        weather: body.weather,
      });
    }

    if (!result.success) {
      const status =
        result.error === "Round not found"
          ? 404
          : result.error === "Not your round"
            ? 403
            : 400;
      return c.json({ error: result.error }, status);
    }
    return c.json({ success: true, data: result.round });
  } catch (error) {
    console.error("Error updating round:", error);
    return c.json({ error: "Failed to update round" }, 500);
  }
});

// ── DELETE /api/rounds/:id ────────────────────────────────────────────────
roundRoutes.delete("/:id", async (c) => {
  try {
    const userId = c.get("user").id;
    const result = await roundService.deleteRound(c.req.param("id"), userId);
    if (!result.success) {
      const status =
        result.error === "Round not found"
          ? 404
          : result.error === "Not your round"
            ? 403
            : 400;
      return c.json({ error: result.error }, status);
    }
    // Recompute stats after deletion
    await Promise.all([
      dispatchStatsRecompute(userId),
      dispatchHandicapRecompute(userId),
    ]);
    return c.json({ success: true, message: "Round deleted" });
  } catch (error) {
    console.error("Error deleting round:", error);
    return c.json({ error: "Failed to delete round" }, 500);
  }
});
