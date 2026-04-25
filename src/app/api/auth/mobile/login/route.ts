import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/services";
import { z } from "zod";
import { SignJWT } from "jose";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const secret = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "fallback-secret",
);

// ── POST /api/auth/mobile/login ───────────────────────────────────────────
// Returns a signed JWT for use in React Native (SecureStore)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 400 },
      );
    }

    const { email, password } = validation.data;
    const result = await authService.validateCredentials({ email, password });

    if (!result.success || !result.user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const user = result.user;

    // Sign a JWT that includes the user's id
    const token = await new SignJWT({
      sub: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(secret);

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarUrl,
        handicap: user.handicap,
      },
    });
  } catch (error) {
    console.error("Mobile login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
