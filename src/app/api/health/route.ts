import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};

  // PostgreSQL
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = "ok";
  } catch {
    checks.postgres = "error";
  }

  // Redis
  if (process.env.REDIS_URL) {
    try {
      const { createClient } = await import("redis");
      const client = createClient({ url: process.env.REDIS_URL });
      await client.connect();
      await client.ping();
      await client.quit();
      checks.redis = "ok";
    } catch {
      checks.redis = "error";
    }
  }

  const allOk = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    { status: allOk ? "ok" : "degraded", checks, ts: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  );
}
