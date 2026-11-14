import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const protectedRoutes = [
  "/round",
  "/session",
  "/stats",
  "/friends",
  "/profile",
  "/settings",
];

const authRoutes = ["/login", "/signup"];

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  // Sessions without an API token predate the API split; the jwt callback
  // in lib/auth.ts signs them out.
  const isLoggedIn = !!token?.apiToken;

  const path = req.nextUrl.pathname;

  const isProtected = protectedRoutes.some((r) => path.startsWith(r));

  const isAuth = authRoutes.includes(path);

  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuth && isLoggedIn) {
    // Already signed in: go where the login was headed. The mobile app's
    // Google button relies on this — it opens /login with its callback, and
    // a browser that still has a session must continue to that callback
    // rather than stop at the home page. Same-origin targets only.
    const callbackUrl = req.nextUrl.searchParams.get("callbackUrl");
    if (callbackUrl) {
      const target = new URL(callbackUrl, req.url);
      if (target.origin === req.nextUrl.origin) {
        return NextResponse.redirect(target);
      }
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|$).*)"],
};
