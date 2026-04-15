import { handlers } from "@/lib/auth";
import { NextRequest } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/ratelimit";

// GET — used for OAuth redirects, session checks — no rate limit needed
export const GET = handlers.GET;

// POST — credentials login + OAuth callbacks
// Only rate limit credentials login attempts, not OAuth callbacks
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const isCredentialsCallback =
    url.searchParams.get("callbackUrl") !== null ||
    req.headers
      .get("content-type")
      ?.includes("application/x-www-form-urlencoded");

  // Clone the request to read the body without consuming it
  const cloned = req.clone();
  let isCredentials = false;

  try {
    const text = await cloned.text();
    isCredentials = text.includes("credentials");
  } catch {
    // Can't read body — skip rate limit check
  }

  if (isCredentials) {
    const { allowed, resetIn } = await checkRateLimit(req, RATE_LIMITS.login);
    if (!allowed) return rateLimitResponse(resetIn);
  }

  return handlers.POST(req);
}
