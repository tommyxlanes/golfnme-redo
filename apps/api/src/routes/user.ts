import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, type AppEnv } from "@/middleware/auth";
import { userService } from "@/services";

export const userRoutes = new Hono<AppEnv>();

userRoutes.use(requireAuth);

// ── GET /api/user/profile ─────────────────────────────────────────────────
userRoutes.get("/profile", async (c) => {
  try {
    const result = await userService.getProfile(c.get("user").id);

    if (!result.success) {
      return c.json({ error: result.error }, 404);
    }

    return c.json({ success: true, user: result.user });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return c.json({ error: "Failed to fetch profile" }, 500);
  }
});

// ── PATCH /api/user/profile ───────────────────────────────────────────────
const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/)
    .optional(),
  handicap: z.number().min(0).max(54).optional().nullable(),
});

userRoutes.patch("/profile", async (c) => {
  try {
    const validation = updateProfileSchema.safeParse(await c.req.json());

    if (!validation.success) {
      return c.json({ error: validation.error.errors[0].message }, 400);
    }

    const result = await userService.updateProfile(
      c.get("user").id,
      validation.data,
    );

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ success: true, user: result.user });
  } catch (error) {
    console.error("Error updating profile:", error);
    return c.json({ error: "Failed to update profile" }, 500);
  }
});
