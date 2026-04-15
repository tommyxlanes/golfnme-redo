import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/services";
import { z } from "zod";
import { withRateLimit, RATE_LIMITS } from "@/lib/ratelimit";

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

export async function POST(request: NextRequest) {
  return withRateLimit(request, RATE_LIMITS.register, async () => {
    try {
      const body = await request.json();
      const validation = registerSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          { error: validation.error.errors[0].message },
          { status: 400 },
        );
      }

      const result = await authService.register(validation.data);

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, user: result.user });
    } catch (error) {
      console.error("Registration error:", error);
      return NextResponse.json(
        { error: "Registration failed. Please try again." },
        { status: 500 },
      );
    }
  });
}
