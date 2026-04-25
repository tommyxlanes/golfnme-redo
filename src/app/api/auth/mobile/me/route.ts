import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

const secret = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "fallback-secret",
);

async function getUserFromToken(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

// ── GET /api/auth/mobile/me ───────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const payload = await getUserFromToken(req);
  if (!payload?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      avatarUrl: true,
      handicap: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

// ── POST /api/auth/mobile/logout ──────────────────────────────────────────
export async function POST() {
  // Token is stored client-side — just confirm logout
  return NextResponse.json({ success: true });
}
