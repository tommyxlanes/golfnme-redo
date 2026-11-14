import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { prisma } from "@/lib/prisma";
import {
  AVATAR_MAX_BYTES,
  AVATAR_TYPES,
  avatarObjectName,
  avatarUrlFor,
  getAvatarBucket,
} from "@/lib/storage";
import { requireAuth, type AppEnv } from "@/middleware/auth";

// ── GET /api/avatars/:userId/:file (public) ───────────────────────────────
// Serves an uploaded avatar. File names carry a timestamp, so a given URL
// never changes content and can be cached forever.
export const avatarRoutes = new Hono();

avatarRoutes.get("/:userId/:file", async (c) => {
  const objectName = avatarObjectName(
    avatarUrlFor(c.req.param("userId"), c.req.param("file")),
  );
  const bucket = getAvatarBucket();
  if (!objectName || !bucket) {
    return c.json({ error: "Not found" }, 404);
  }

  try {
    const [bytes] = await bucket.file(objectName).download();
    const ext = objectName.split(".").pop()!;
    const contentType =
      Object.entries(AVATAR_TYPES).find(([, e]) => e === ext)?.[0] ??
      "application/octet-stream";

    return c.body(new Uint8Array(bytes), 200, {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    });
  } catch (err: any) {
    if (err?.code === 404) return c.json({ error: "Not found" }, 404);
    console.error("[avatars] download failed:", err);
    return c.json({ error: "Failed to load avatar" }, 500);
  }
});

// ── /api/user/avatar ──────────────────────────────────────────────────────
export const userAvatarRoutes = new Hono<AppEnv>();

userAvatarRoutes.use(requireAuth);

async function deleteObject(avatarUrl: string | null) {
  const objectName = avatarObjectName(avatarUrl);
  if (!objectName) return;
  await getAvatarBucket()
    ?.file(objectName)
    .delete({ ignoreNotFound: true })
    .catch((err) => console.error("[avatars] delete failed:", err));
}

// POST — multipart/form-data with the image in the "avatar" field.
// Returns { success, avatarUrl }.
userAvatarRoutes.post(
  "/",
  bodyLimit({
    maxSize: AVATAR_MAX_BYTES + 64 * 1024, // room for the multipart framing
    onError: (c) => c.json({ error: "Image must be 5 MB or smaller" }, 413),
  }),
  async (c) => {
    const bucket = getAvatarBucket();
    if (!bucket) {
      return c.json({ error: "Avatar storage is not configured" }, 503);
    }

    const body = await c.req.parseBody().catch(() => null);
    const file = body?.avatar;
    if (!(file instanceof File)) {
      return c.json({ error: "No image uploaded" }, 400);
    }

    const ext = AVATAR_TYPES[file.type];
    if (!ext) {
      return c.json({ error: "Image must be a JPEG, PNG or WebP" }, 400);
    }
    if (file.size > AVATAR_MAX_BYTES) {
      return c.json({ error: "Image must be 5 MB or smaller" }, 413);
    }

    const userId = c.get("user").id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    try {
      const fileName = `${Date.now()}.${ext}`;
      await bucket
        .file(`avatars/${userId}/${fileName}`)
        .save(Buffer.from(await file.arrayBuffer()), {
          contentType: file.type,
          resumable: false,
        });

      const avatarUrl = avatarUrlFor(userId, fileName);
      await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
      await deleteObject(user.avatarUrl);

      return c.json({ success: true, avatarUrl });
    } catch (err) {
      console.error("[avatars] upload failed:", err);
      return c.json({ error: "Upload failed" }, 500);
    }
  },
);

// DELETE — remove the current avatar
userAvatarRoutes.delete("/", async (c) => {
  const userId = c.get("user").id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  await prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
  await deleteObject(user.avatarUrl);

  return c.json({ success: true, avatarUrl: null });
});
