import { Hono } from "hono";
import { z } from "zod";
import { dispatchNotification } from "@/lib/queue";
import { requireAuth, type AppEnv } from "@/middleware/auth";
import { friendService } from "@/services";

export const friendRoutes = new Hono<AppEnv>();

friendRoutes.use(requireAuth);

// ── GET /api/friends ──────────────────────────────────────────────────────
// ?type=requests (received) | pending (sent) | none (friends list)
friendRoutes.get("/", async (c) => {
  try {
    const userId = c.get("user").id;
    const type = c.req.query("type");

    if (type === "requests") {
      const result = await friendService.getPendingRequests(userId);
      return c.json(result.requests);
    }

    if (type === "pending") {
      const result = await friendService.getSentRequests(userId);
      return c.json(result.requests);
    }

    const result = await friendService.getFriends(userId);
    return c.json(result.friends);
  } catch (error) {
    console.error("Error fetching friends:", error);
    return c.json({ error: "Failed to fetch friends" }, 500);
  }
});

// ── GET /api/friends/search?query=... ─────────────────────────────────────
friendRoutes.get("/search", async (c) => {
  const query = c.req.query("query") ?? "";

  if (!query || query.length < 2) {
    return c.json({ users: [] });
  }

  const result = await friendService.searchUsers(query, c.get("user").id);

  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({ users: result.users });
});

// ── POST /api/friends ─────────────────────────────────────────────────────
// Send a friend request
const sendRequestSchema = z.object({
  username: z.string().min(1),
});

friendRoutes.post("/", async (c) => {
  try {
    const userId = c.get("user").id;
    const validation = sendRequestSchema.safeParse(await c.req.json());
    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    const result = await friendService.sendRequest(
      userId,
      validation.data.username,
    );

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    // Notify recipient via Ably
    if (result.receiverId) {
      await dispatchNotification({
        kind: "friend_request",
        recipientId: result.receiverId,
        actorId: userId,
      }).catch(() => {});
    }

    return c.json({ success: true, message: "Friend request sent" });
  } catch (error) {
    console.error("Error sending friend request:", error);
    return c.json({ error: "Failed to send friend request" }, 500);
  }
});

// ── PATCH /api/friends ────────────────────────────────────────────────────
// Accept / decline / cancel a request
const updateRequestSchema = z.object({
  requestId: z.string(),
  action: z.enum(["accept", "decline", "cancel"]),
});

friendRoutes.patch("/", async (c) => {
  try {
    const userId = c.get("user").id;
    const validation = updateRequestSchema.safeParse(await c.req.json());

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    const { requestId, action } = validation.data;

    let result;
    if (action === "accept") {
      result = await friendService.acceptRequest(requestId, userId);
    } else if (action === "decline") {
      result = await friendService.declineRequest(requestId, userId);
    } else {
      result = await friendService.cancelRequest(requestId, userId);
    }

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    // Notify original sender when accepted
    if (action === "accept" && result.senderId) {
      await dispatchNotification({
        kind: "friend_accepted",
        recipientId: result.senderId,
        actorId: userId,
      }).catch(() => {});
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error updating friend request:", error);
    return c.json({ error: "Failed to update friend request" }, 500);
  }
});

// ── DELETE /api/friends?friendId=... ──────────────────────────────────────
friendRoutes.delete("/", async (c) => {
  try {
    const friendId = c.req.query("friendId");

    if (!friendId) {
      return c.json({ error: "Friend ID required" }, 400);
    }

    const result = await friendService.removeFriend(c.get("user").id, friendId);
    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ success: true, message: "Friend removed" });
  } catch (error) {
    console.error("Error removing friend:", error);
    return c.json({ error: "Failed to remove friend" }, 500);
  }
});
