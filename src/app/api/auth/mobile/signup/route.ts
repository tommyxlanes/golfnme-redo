import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { z } from "zod";

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

const secret = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "fallback-secret",
);

// ── POST /api/auth/mobile/signup ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = signupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 },
      );
    }

    const { name, email, username, password } = validation.data;

    // Check duplicates
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existing) {
      const field = existing.email === email ? "email" : "username";
      return NextResponse.json(
        { error: `This ${field} is already taken` },
        { status: 409 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { name, email, username, password: hashedPassword },
    });

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
        avatarUrl: null,
        handicap: null,
      },
    });
  } catch (error) {
    console.error("Mobile signup error:", error);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
