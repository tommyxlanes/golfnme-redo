import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { SignJWT } from "jose";

const secret = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "fallback-secret",
);

// ── GET /api/auth/mobile/callback ─────────────────────────────────────────
// After NextAuth completes Google OAuth on web, the mobile app opens this
// URL in a browser. This route reads the NextAuth session cookie, issues
// a mobile JWT, then redirects back to the app via deep link.
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      // Not authenticated — redirect back to app with error
      return NextResponse.redirect(
        new URL(`golfnme://auth?error=not_authenticated`, req.url),
      );
    }

    const token = await new SignJWT({
      sub: session.user.id,
      email: session.user.email,
      name: session.user.name,
      username: (session.user as any).username,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(secret);

    // Deep link back to the app with the token
    return NextResponse.redirect(`golfnme://auth?token=${token}`);
  } catch (error) {
    console.error("Mobile callback error:", error);
    return NextResponse.redirect(`golfnme://auth?error=server_error`);
  }
}
