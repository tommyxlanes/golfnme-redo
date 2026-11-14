import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, type AppEnv } from "@/middleware/auth";
import { courseService } from "@/services";

export const courseRoutes = new Hono<AppEnv>();

const GOLF_API_BASE = "https://api.golfcourseapi.com/v1";

interface GolfApiTeeBox {
  tee_name: string;
  course_rating: number;
  slope_rating: number;
  par_total: number;
  total_yards: number;
  number_of_holes: number;
  holes: Array<{ par: number; yardage: number; handicap: number }>;
}

interface GolfApiCourse {
  id: number;
  club_name: string;
  course_name: string;
  location: {
    address: string;
    city: string;
    state: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  tees: {
    male: GolfApiTeeBox[];
    female: GolfApiTeeBox[];
  };
}

// ── GET /api/courses (public) ─────────────────────────────────────────────
courseRoutes.get("/", async (c) => {
  try {
    const result = await courseService.getCourses({
      search: c.req.query("search"),
      take: parseInt(c.req.query("limit") || "50"),
    });

    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }

    return c.json({ success: true, data: result.courses });
  } catch (error) {
    console.error("Error fetching courses:", error);
    return c.json({ error: "Failed to fetch courses" }, 500);
  }
});

// ── GET /api/courses/search?q=pebble beach (public) ───────────────────────
// Proxies to Golf Course API — keeps the API key server-side.
// Same search terms return the same results, so cache them for 10 minutes.
const SEARCH_TTL_MS = 10 * 60 * 1000;
const SEARCH_CACHE_MAX = 500;
const searchCache = new Map<string, { at: number; courses: unknown[] }>();

courseRoutes.get("/search", async (c) => {
  const q = c.req.query("q")?.trim();

  if (!q || q.length < 2) {
    return c.json({ courses: [] });
  }

  const apiKey = process.env.GOLF_COURSE_API_KEY;
  if (!apiKey) {
    return c.json({ error: "Golf Course API key not configured" }, 500);
  }

  const cacheKey = q.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.at < SEARCH_TTL_MS) {
    return c.json({ courses: cached.courses });
  }

  try {
    const res = await fetch(
      `${GOLF_API_BASE}/search?search_query=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Key ${apiKey}` } },
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("[golf-api] search failed:", res.status, text);
      return c.json({ error: "Course search failed" }, res.status as any);
    }

    const data = (await res.json()) as any;
    const courses: unknown[] = data.courses ?? [];

    if (searchCache.size >= SEARCH_CACHE_MAX) searchCache.clear();
    searchCache.set(cacheKey, { at: Date.now(), courses });

    return c.json({ courses });
  } catch (err) {
    console.error("[golf-api] search error:", err);
    return c.json({ error: "Course search failed" }, 500);
  }
});

// ── POST /api/courses ─────────────────────────────────────────────────────
const createCourseSchema = z.object({
  name: z.string().min(2),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default("USA"),
  par: z.number().int().min(27).max(80).default(72),
  numHoles: z.number().int().min(9).max(18).default(18),
  rating: z.number().optional(),
  slope: z.number().int().optional(),
  holes: z
    .array(
      z.object({
        holeNumber: z.number().int().min(1).max(18),
        par: z.number().int().min(3).max(6),
        yardage: z.number().int().optional(),
        handicapRank: z.number().int().min(1).max(18).optional(),
      }),
    )
    .optional(),
});

courseRoutes.post("/", requireAuth, async (c) => {
  try {
    const validation = createCourseSchema.safeParse(await c.req.json());

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    const result = await courseService.createCourse(validation.data);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ success: true, data: result.course });
  } catch (error) {
    console.error("Error creating course:", error);
    return c.json({ error: "Failed to create course" }, 500);
  }
});

// ── POST /api/courses/import ──────────────────────────────────────────────
// Body: { golfApiId: number, teePreference?: string }
//
// Fetches full course from Golf Course API and imports it into the local DB
// including all holes. If the course already exists (matched by name+city),
// returns it.
courseRoutes.post("/import", requireAuth, async (c) => {
  const apiKey = process.env.GOLF_COURSE_API_KEY;
  if (!apiKey) {
    return c.json({ error: "Golf Course API key not configured" }, 500);
  }

  const body = await c.req.json();
  const { golfApiId, teePreference = "white" } = body;

  if (!golfApiId) {
    return c.json({ error: "golfApiId is required" }, 400);
  }

  // ── Fetch full course from Golf API ──────────────────────────────────────
  let apiCourse: GolfApiCourse;
  try {
    const res = await fetch(`${GOLF_API_BASE}/courses/${golfApiId}`, {
      headers: { Authorization: `Key ${apiKey}` },
    });
    if (!res.ok) {
      return c.json({ error: "Course not found" }, 404);
    }
    const data = (await res.json()) as any;
    apiCourse = data.course ?? data;
  } catch (err) {
    console.error("[golf-api] import fetch error:", err);
    return c.json({ error: "Failed to fetch course data" }, 500);
  }

  // ── Check if already imported ─────────────────────────────────────────────
  const courseName = apiCourse.course_name || apiCourse.club_name;
  const existing = await prisma.course.findFirst({
    where: {
      name: courseName,
      city: apiCourse.location.city,
    },
    include: { holes: { orderBy: { holeNumber: "asc" } } },
  });

  if (existing) {
    return c.json({ success: true, data: existing, imported: false });
  }

  // ── Pick best tee box ─────────────────────────────────────────────────────
  // Priority: match teePreference name → white → blue → first available
  const allTees = [
    ...(apiCourse.tees?.male ?? []),
    ...(apiCourse.tees?.female ?? []),
  ];
  const maleTees = apiCourse.tees?.male ?? [];

  const tee =
    maleTees.find(
      (t) => t.tee_name.toLowerCase() === teePreference.toLowerCase(),
    ) ||
    maleTees.find((t) => t.tee_name.toLowerCase() === "white") ||
    maleTees.find((t) => t.tee_name.toLowerCase() === "blue") ||
    maleTees[0] ||
    allTees[0];

  if (!tee) {
    return c.json({ error: "No tee data available for this course" }, 422);
  }

  // ── Build hole data ───────────────────────────────────────────────────────
  const holes = (tee.holes ?? []).map((h, i) => ({
    holeNumber: i + 1,
    par: h.par,
    yardage: h.yardage ?? null,
    handicapRank: h.handicap ?? null,
  }));

  // Fall back to generic holes if API didn't return hole detail
  const holeData =
    holes.length > 0
      ? holes
      : Array.from({ length: tee.number_of_holes ?? 18 }, (_, i) => ({
          holeNumber: i + 1,
          par: 4,
          yardage: null,
          handicapRank: null,
        }));

  // ── Save to DB ────────────────────────────────────────────────────────────
  try {
    const course = await prisma.course.create({
      data: {
        name: courseName,
        city: apiCourse.location.city ?? null,
        state: apiCourse.location.state ?? null,
        country: apiCourse.location.country ?? "USA",
        address: apiCourse.location.address ?? null,
        latitude: apiCourse.location.latitude ?? null,
        longitude: apiCourse.location.longitude ?? null,
        par: tee.par_total ?? 72,
        numHoles: tee.number_of_holes ?? 18,
        rating: tee.course_rating ?? null,
        slope: tee.slope_rating ?? null,
        isPublic: true,
        holes: {
          create: holeData,
        },
      },
      include: { holes: { orderBy: { holeNumber: "asc" } } },
    });

    return c.json({ success: true, data: course, imported: true });
  } catch (err) {
    console.error("[golf-api] DB save error:", err);
    return c.json({ error: "Failed to save course" }, 500);
  }
});

// ── PATCH /api/courses/:id/holes ──────────────────────────────────────────
// Update a single hole's par/yardage on a course.
// Persists for ALL users — community shared.
const updateHoleSchema = z.object({
  holeNumber: z.number().int().min(1).max(18),
  par: z.number().int().min(3).max(6),
  yardage: z.number().int().optional().nullable(),
  handicapRank: z.number().int().min(1).max(18).optional().nullable(),
});

courseRoutes.patch("/:id/holes", requireAuth, async (c) => {
  const courseId = c.req.param("id");
  const validation = updateHoleSchema.safeParse(await c.req.json());

  if (!validation.success) {
    return c.json({ error: validation.error.errors }, 400);
  }

  const { holeNumber, par, yardage, handicapRank } = validation.data;

  const hole = await prisma.hole.findFirst({
    where: { courseId, holeNumber },
  });

  if (!hole) {
    return c.json({ error: "Hole not found" }, 404);
  }

  const updated = await prisma.hole.update({
    where: { id: hole.id },
    data: {
      par,
      ...(yardage !== undefined ? { yardage } : {}),
      ...(handicapRank !== undefined ? { handicapRank } : {}),
    },
  });

  // Recompute and update course total par
  const allHoles = await prisma.hole.findMany({ where: { courseId } });
  const totalPar = allHoles.reduce((sum, h) => sum + h.par, 0);
  await prisma.course.update({
    where: { id: courseId },
    data: { par: totalPar },
  });

  return c.json({ success: true, hole: updated, totalPar });
});

// ── PUT /api/courses/:id/holes ────────────────────────────────────────────
// Bulk-upsert all holes for a course (used when creating with full scorecard)
const bulkHoleSchema = z.object({
  holes: z.array(
    z.object({
      holeNumber: z.number().int().min(1).max(18),
      par: z.number().int().min(3).max(6),
      yardage: z.number().int().optional().nullable(),
      handicapRank: z.number().int().optional().nullable(),
    }),
  ),
});

courseRoutes.put("/:id/holes", requireAuth, async (c) => {
  const courseId = c.req.param("id");
  const validation = bulkHoleSchema.safeParse(await c.req.json());

  if (!validation.success) {
    return c.json({ error: validation.error.errors }, 400);
  }

  const results = await Promise.all(
    validation.data.holes.map((h) =>
      prisma.hole.upsert({
        where: { courseId_holeNumber: { courseId, holeNumber: h.holeNumber } },
        update: {
          par: h.par,
          yardage: h.yardage ?? null,
          handicapRank: h.handicapRank ?? null,
        },
        create: {
          courseId,
          holeNumber: h.holeNumber,
          par: h.par,
          yardage: h.yardage ?? null,
          handicapRank: h.handicapRank ?? null,
        },
      }),
    ),
  );

  // Update total par
  const totalPar = results.reduce((sum, h) => sum + h.par, 0);
  await prisma.course.update({
    where: { id: courseId },
    data: { par: totalPar },
  });

  return c.json({ success: true, holes: results, totalPar });
});
