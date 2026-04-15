import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

// ─────────────────────────────────────────────
// POST /api/courses/import
// Body: { golfApiId: number, teeName?: string }
//
// Fetches full course from Golf Course API and imports
// it into the local DB including all holes.
// If the course already exists (matched by name+city), returns it.
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GOLF_COURSE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Golf Course API key not configured" },
      { status: 500 },
    );
  }

  const body = await req.json();
  const { golfApiId, teePreference = "white" } = body;

  if (!golfApiId) {
    return NextResponse.json(
      { error: "golfApiId is required" },
      { status: 400 },
    );
  }

  // ── Fetch full course from Golf API ──────────────────────────────────────
  let apiCourse: GolfApiCourse;
  try {
    const res = await fetch(`${GOLF_API_BASE}/courses/${golfApiId}`, {
      headers: { Authorization: `Key ${apiKey}` },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    const data = await res.json();
    apiCourse = data.course ?? data;
  } catch (err) {
    console.error("[golf-api] import fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch course data" },
      { status: 500 },
    );
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
    return NextResponse.json({
      success: true,
      data: existing,
      imported: false,
    });
  }

  // ── Pick best tee box ─────────────────────────────────────────────────────
  // Priority: match teePreference name → white → first available
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
    return NextResponse.json(
      { error: "No tee data available for this course" },
      { status: 422 },
    );
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

    return NextResponse.json({ success: true, data: course, imported: true });
  } catch (err) {
    console.error("[golf-api] DB save error:", err);
    return NextResponse.json(
      { error: "Failed to save course" },
      { status: 500 },
    );
  }
}
