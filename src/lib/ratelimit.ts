import { NextRequest, NextResponse } from "next/server";
import { createClient } from "redis";

// ─────────────────────────────────────────────
// Redis client (reuse connection across requests)
// ─────────────────────────────────────────────
let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedis() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
    });
    redisClient.on("error", (err) =>
      console.error("[ratelimit] Redis error:", err),
    );
    await redisClient.connect();
  }
  return redisClient;
}

// ─────────────────────────────────────────────
// Rate limit config per route type
// ─────────────────────────────────────────────
export interface RateLimitConfig {
  // Max requests allowed in the window
  limit: number;
  // Window size in seconds
  windowSecs: number;
  // Key prefix — separates limits per route
  prefix: string;
}

export const RATE_LIMITS = {
  // 5 login attempts per 15 minutes per IP
  login: {
    limit: 5,
    windowSecs: 15 * 60,
    prefix: "rl:login",
  },
  // 3 registrations per hour per IP
  register: {
    limit: 3,
    windowSecs: 60 * 60,
    prefix: "rl:register",
  },
  // 10 password reset requests per hour per IP
  passwordReset: {
    limit: 10,
    windowSecs: 60 * 60,
    prefix: "rl:pwreset",
  },
  // General API — 100 requests per minute per IP
  api: {
    limit: 100,
    windowSecs: 60,
    prefix: "rl:api",
  },
} satisfies Record<string, RateLimitConfig>;

// ─────────────────────────────────────────────
// Get client IP from request
// ─────────────────────────────────────────────
function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// ─────────────────────────────────────────────
// Core rate limit check — sliding window counter
// Returns { allowed, remaining, resetIn }
// ─────────────────────────────────────────────
export async function checkRateLimit(
  req: NextRequest,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  // Skip rate limiting if Redis URL not configured
  if (!process.env.REDIS_URL && process.env.NODE_ENV === "development") {
    return { allowed: true, remaining: config.limit, resetIn: 0 };
  }

  try {
    const redis = await getRedis();
    const ip = getIP(req);
    const key = `${config.prefix}:${ip}`;

    const current = await redis.incr(key);

    // Set expiry on first request
    if (current === 1) {
      await redis.expire(key, config.windowSecs);
    }

    const ttl = await redis.ttl(key);
    const remaining = Math.max(0, config.limit - current);
    const allowed = current <= config.limit;

    return { allowed, remaining, resetIn: ttl };
  } catch (err) {
    // If Redis is down, fail open — don't block legitimate users
    console.error("[ratelimit] Redis check failed, failing open:", err);
    return { allowed: true, remaining: config.limit, resetIn: 0 };
  }
}

// ─────────────────────────────────────────────
// Rate limit response helper
// ─────────────────────────────────────────────
export function rateLimitResponse(resetIn: number): NextResponse {
  const minutes = Math.ceil(resetIn / 60);
  return NextResponse.json(
    {
      error: `Too many attempts. Please try again in ${minutes} minute${minutes !== 1 ? "s" : ""}.`,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(resetIn),
        "X-RateLimit-Reset": String(Date.now() + resetIn * 1000),
      },
    },
  );
}

// ─────────────────────────────────────────────
// Convenience wrapper — use this in route handlers
// ─────────────────────────────────────────────
export async function withRateLimit(
  req: NextRequest,
  config: RateLimitConfig,
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const { allowed, resetIn } = await checkRateLimit(req, config);
  if (!allowed) return rateLimitResponse(resetIn);
  return handler();
}
