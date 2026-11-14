import { Hono } from "hono";
import { prisma } from "@/lib/prisma";
import { requireAuth, type AppEnv } from "@/middleware/auth";

export const notificationRoutes = new Hono<AppEnv>();

notificationRoutes.use(requireAuth);

// ── GET /api/notifications ────────────────────────────────────────────────
// Returns last 20 notifications for the current user
notificationRoutes.get("/", async (c) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: c.get("user").id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return c.json({ notifications });
});

// ── PATCH /api/notifications ──────────────────────────────────────────────
// Mark notifications as read
// Body: { ids?: string[] }  — if no ids, marks ALL as read
notificationRoutes.patch("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const ids: string[] | undefined = body.ids;

  await prisma.notification.updateMany({
    where: {
      userId: c.get("user").id,
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    data: { read: true },
  });

  return c.json({ success: true });
});

// ── DELETE /api/notifications ─────────────────────────────────────────────
// Query: ?id=xxx  — deletes single; no query = clears all
notificationRoutes.delete("/", async (c) => {
  const id = c.req.query("id");

  await prisma.notification.deleteMany({
    where: {
      userId: c.get("user").id,
      ...(id ? { id } : {}),
    },
  });

  return c.json({ success: true });
});
