import { Hono, type Context } from "hono";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signAccessToken } from "@/lib/jwt";
import { rateLimit, RATE_LIMITS } from "@/lib/ratelimit";
import { requireAuth, type AppEnv } from "@/middleware/auth";
import { authService } from "@/services";

export const authRoutes = new Hono<AppEnv>();

type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  handicap: number | null;
};

// The { token, user } body every sign-in endpoint returns.
async function tokenResponse(user: PublicUser) {
  return {
    token: await signAccessToken(user),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      avatarUrl: user.avatarUrl,
      handicap: user.handicap,
    },
  };
}

// ── POST /api/auth/register ───────────────────────────────────────────────
// Creates the account only; the client then calls /login.
const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores",
    ),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

authRoutes.post("/register", rateLimit(RATE_LIMITS.register), async (c) => {
  try {
    const validation = registerSchema.safeParse(await c.req.json());
    if (!validation.success) {
      return c.json({ error: validation.error.errors[0].message }, 400);
    }

    const result = await authService.register(validation.data);
    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ success: true, user: result.user });
  } catch (error) {
    console.error("Registration error:", error);
    return c.json({ error: "Registration failed. Please try again." }, 500);
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────
// Returns a Bearer token (valid 30 days) plus the user.
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

async function login(c: Context<AppEnv>) {
  try {
    const validation = loginSchema.safeParse(await c.req.json());
    if (!validation.success) {
      return c.json({ error: "Invalid credentials" }, 400);
    }

    const result = await authService.validateCredentials(validation.data);
    if (!result.success || !result.user) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    return c.json(await tokenResponse(result.user));
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ error: "Login failed" }, 500);
  }
}

// ── POST /api/auth/signup ─────────────────────────────────────────────────
// Register + login in one call (what the mobile app uses).
const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-z0-9_]+$/),
  password: z.string().min(6),
});

async function signup(c: Context<AppEnv>) {
  try {
    const validation = signupSchema.safeParse(await c.req.json());
    if (!validation.success) {
      return c.json({ error: validation.error.errors[0].message }, 400);
    }

    const { email, username } = validation.data;
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      const field = existing.email === email ? "email" : "username";
      return c.json({ error: `This ${field} is already taken` }, 409);
    }

    const result = await authService.register(validation.data);
    if (!result.success || !result.user) {
      return c.json({ error: result.error ?? "Signup failed" }, 400);
    }

    return c.json(await tokenResponse(result.user));
  } catch (error) {
    console.error("Signup error:", error);
    return c.json({ error: "Signup failed" }, 500);
  }
}

// ── GET /api/auth/me ──────────────────────────────────────────────────────
async function me(c: Context<AppEnv>) {
  const user = await prisma.user.findUnique({
    where: { id: c.get("user").id },
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
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ user });
}

// ── POST /api/auth/logout ─────────────────────────────────────────────────
// Tokens are stateless and stored client-side — the client just drops it.
function logout(c: Context<AppEnv>) {
  return c.json({ success: true });
}

authRoutes.post("/login", rateLimit(RATE_LIMITS.login), login);
authRoutes.post("/signup", rateLimit(RATE_LIMITS.register), signup);
authRoutes.get("/me", requireAuth, me);
authRoutes.post("/logout", logout);

// Paths the Expo app already calls (POST /mobile/me was the old logout).
authRoutes.post("/mobile/login", rateLimit(RATE_LIMITS.login), login);
authRoutes.post("/mobile/signup", rateLimit(RATE_LIMITS.register), signup);
authRoutes.get("/mobile/me", requireAuth, me);
authRoutes.post("/mobile/me", logout);
authRoutes.post("/mobile/logout", logout);

// ── POST /api/auth/google ─────────────────────────────────────────────────
// Body: { idToken } — a Google ID token from the web OAuth flow or from
// native Google Sign-In in the Expo app. It is verified against Google's
// public keys, then exchanged for our own Bearer token.
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

// GOOGLE_CLIENT_ID is the web client; GOOGLE_CLIENT_IDS (comma-separated)
// adds the iOS / Android client IDs the Expo app signs in with.
function googleAudiences(): string[] {
  return [process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_IDS]
    .flatMap((v) => (v ? v.split(",") : []))
    .map((v) => v.trim())
    .filter(Boolean);
}

async function uniqueUsername(seed: string): Promise<string> {
  const base =
    seed
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 15) || "golfer";

  let username = base;
  let attempt = 0;
  while (await prisma.user.findUnique({ where: { username } })) {
    attempt++;
    username = `${base}${attempt}`;
  }
  return username;
}

authRoutes.post("/google", async (c) => {
  const audience = googleAudiences();
  if (audience.length === 0) {
    return c.json({ error: "Google sign-in is not configured" }, 500);
  }

  const body = await c.req.json().catch(() => ({}));
  const idToken = typeof body.idToken === "string" ? body.idToken : null;
  if (!idToken) {
    return c.json({ error: "idToken is required" }, 400);
  }

  let claims: JWTPayload;
  try {
    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience,
    });
    claims = payload;
  } catch {
    return c.json({ error: "Invalid Google token" }, 401);
  }

  const email = claims.email as string | undefined;
  if (!claims.sub || !email || claims.email_verified !== true) {
    return c.json({ error: "Google account has no verified email" }, 401);
  }

  try {
    const name = (claims.name as string | undefined) ?? null;
    const picture = (claims.picture as string | undefined) ?? null;

    // Same email → same user, whether they first signed up with a password
    // or with Google.
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          image: picture,
          avatarUrl: picture,
          emailVerified: new Date(),
          username: await uniqueUsername(name ?? email.split("@")[0]),
        },
      });
    } else if (!user.username) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          username: await uniqueUsername(user.name ?? email.split("@")[0]),
        },
      });
    }

    await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: claims.sub,
        },
      },
      update: {},
      create: {
        userId: user.id,
        type: "oidc",
        provider: "google",
        providerAccountId: claims.sub,
      },
    });

    return c.json(await tokenResponse(user));
  } catch (error) {
    console.error("Google sign-in error:", error);
    return c.json({ error: "Google sign-in failed" }, 500);
  }
});
