import { NextRequest, NextResponse } from "next/server";

const GOLF_API_BASE = "https://api.golfcourseapi.com/v1";

// ─────────────────────────────────────────────
// GET /api/courses/search?q=pebble beach
// Proxies to Golf Course API — keeps the API key server-side
// ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ courses: [] });
  }

  const apiKey = process.env.GOLF_COURSE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Golf Course API key not configured" },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(
      `${GOLF_API_BASE}/search?search_query=${encodeURIComponent(q)}`,
      {
        headers: { Authorization: `Key ${apiKey}` },
        // Cache for 10 minutes — same search terms return same results
        next: { revalidate: 600 },
      },
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("[golf-api] search failed:", res.status, text);
      return NextResponse.json(
        { error: "Course search failed" },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json({ courses: data.courses ?? [] });
  } catch (err) {
    console.error("[golf-api] search error:", err);
    return NextResponse.json(
      { error: "Course search failed" },
      { status: 500 },
    );
  }
}
