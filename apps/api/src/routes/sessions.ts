import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { dispatchNotification } from "@/lib/queue";
import { requireAuth, type AppEnv } from "@/middleware/auth";
import { sessionService } from "@/services";
import { chatService } from "@/services/chat.service";

export const sessionRoutes = new Hono<AppEnv>();

sessionRoutes.use(requireAuth);

// ── GET /api/sessions ─────────────────────────────────────────────────────
// ?inviteCode=ABC123 returns that session; otherwise the user's sessions.
sessionRoutes.get("/", async (c) => {
  try {
    const inviteCode = c.req.query("inviteCode");

    if (inviteCode) {
      const result = await sessionService.getSessionByInviteCode(inviteCode);

      if (!result.success) {
        return c.json({ error: result.error }, 404);
      }

      return c.json({ success: true, data: result.session });
    }

    const result = await sessionService.getUserSessions(c.get("user").id, {
      status: c.req.query("status") as any,
    });

    return c.json({ success: true, data: result.sessions });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return c.json({ error: "Failed to fetch sessions" }, 500);
  }
});

// ── POST /api/sessions ────────────────────────────────────────────────────
// Body with inviteCode joins; otherwise creates.
const createSessionSchema = z.object({
  courseId: z.string(),
  name: z.string().optional(),
  maxPlayers: z.number().int().min(2).max(8).default(4),
});

const joinSessionSchema = z.object({
  inviteCode: z.string().min(6).max(6),
});

sessionRoutes.post("/", async (c) => {
  try {
    const userId = c.get("user").id;
    const body = await c.req.json();

    if (body.inviteCode) {
      const validation = joinSessionSchema.safeParse(body);

      if (!validation.success) {
        return c.json({ error: validation.error.errors }, 400);
      }

      const result = await sessionService.joinSession(
        validation.data.inviteCode,
        userId,
      );

      if (!result.success) {
        return c.json({ error: result.error }, 400);
      }

      return c.json({ success: true, data: result.session });
    }

    const validation = createSessionSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    const result = await sessionService.createSession({
      hostId: userId,
      ...validation.data,
    });

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ success: true, data: result.session });
  } catch (error) {
    console.error("Error with session:", error);
    return c.json({ error: "Failed to process session request" }, 500);
  }
});

// ── PATCH /api/sessions ───────────────────────────────────────────────────
// Body: { sessionId, action }
const updateSessionSchema = z.object({
  sessionId: z.string(),
  action: z.enum(["start", "end", "cancel", "ready", "unready", "leave"]),
});

sessionRoutes.patch("/", async (c) => {
  try {
    const userId = c.get("user").id;
    const validation = updateSessionSchema.safeParse(await c.req.json());

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    const { sessionId, action } = validation.data;
    let result;

    switch (action) {
      case "start":
        result = await sessionService.startSession(sessionId, userId);
        break;
      case "end":
        result = await sessionService.endSession(sessionId, userId);
        break;
      case "cancel": {
        const r = await sessionService.cancelSession(sessionId, userId);
        return c.json({ success: r.success, error: r.error });
      }
      case "ready":
      case "unready": {
        const r = await sessionService.setReady(
          sessionId,
          userId,
          action === "ready",
        );
        return c.json({
          success: r.success,
          allReady: r.allReady,
          error: r.error,
        });
      }
      case "leave": {
        const r = await sessionService.leaveSession(sessionId, userId);
        return c.json({ success: r.success, error: r.error });
      }
    }

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ success: true, data: result.session });
  } catch (error) {
    console.error("Error updating session:", error);
    return c.json({ error: "Failed to update session" }, 500);
  }
});

// ── GET /api/sessions/:id/chat ────────────────────────────────────────────
// ?since=ISO date returns only newer messages (for polling); ?take=N limits.
sessionRoutes.get("/:id/chat", async (c) => {
  try {
    const sessionId = c.req.param("id");
    const userId = c.get("user").id;
    const take = c.req.query("take");
    const since = c.req.query("since");

    if (since) {
      const result = await chatService.getNewMessages(
        sessionId,
        userId,
        new Date(since),
      );

      if (!result.success) {
        return c.json({ error: result.error }, 400);
      }

      return c.json({ success: true, data: result.messages });
    }

    const result = await chatService.getMessages(sessionId, userId, {
      take: take ? parseInt(take, 10) : 100,
    });

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ success: true, data: result.messages });
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    return c.json({ error: "Failed to fetch messages" }, 500);
  }
});

// ── POST /api/sessions/:id/chat ───────────────────────────────────────────
const sendMessageSchema = z.object({
  text: z.string().min(1).max(1000),
});

sessionRoutes.post("/:id/chat", async (c) => {
  try {
    const sessionId = c.req.param("id");
    const user = c.get("user");
    const validation = sendMessageSchema.safeParse(await c.req.json());

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    const result = await chatService.sendMessage({
      sessionId,
      userId: user.id,
      userName: user.name || user.username || "Player",
      text: validation.data.text,
    });

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    // Notify all other session members via Ably
    // so they see a badge even if they navigated away
    try {
      const sessionData = await prisma.groupSession.findUnique({
        where: { id: sessionId },
        include: { members: { select: { userId: true } } },
      });

      if (sessionData) {
        const otherMembers = sessionData.members
          .map((m) => m.userId)
          .filter((id) => id !== user.id);

        await Promise.allSettled(
          otherMembers.map((recipientId) =>
            dispatchNotification({
              kind: "session_chat" as any,
              recipientId,
              actorId: user.id,
              meta: {
                sessionCode: sessionData.inviteCode,
                preview: validation.data.text.slice(0, 60),
              },
            }),
          ),
        );
      }
    } catch {
      // Non-fatal — message already sent
    }

    return c.json({ success: true, data: result.message });
  } catch (error) {
    console.error("Error sending chat message:", error);
    return c.json({ error: "Failed to send message" }, 500);
  }
});

// ── DELETE /api/sessions/:id/chat ─────────────────────────────────────────
// Clear chat (host only)
sessionRoutes.delete("/:id/chat", async (c) => {
  try {
    const result = await chatService.clearMessages(
      c.req.param("id"),
      c.get("user").id,
    );

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error clearing chat messages:", error);
    return c.json({ error: "Failed to clear messages" }, 500);
  }
});
