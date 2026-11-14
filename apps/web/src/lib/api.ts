import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Server-side only: where the standalone API (apps/api) lives.
export const API_URL = (process.env.API_URL || "http://localhost:4000").replace(
  /\/$/,
  "",
);

export interface ApiAuthResult {
  token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    username: string | null;
    avatarUrl: string | null;
    handicap: number | null;
  };
}

// Sign in against the API. Returns null when the API rejects the credentials.
export async function apiSignIn(
  path: "/api/auth/login" | "/api/auth/google",
  body: Record<string, string>,
  forwardedFor?: string | null,
): Promise<ApiAuthResult | null> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Keeps the API's per-IP login rate limit keyed on the browser, not us.
      ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) return null;
  return (await res.json()) as ApiAuthResult;
}

// The API Bearer token stored in the signed-in user's NextAuth cookie.
// It never reaches the browser — only route handlers read it.
export async function getApiToken(req: NextRequest): Promise<string | null> {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  // The cookie is `__Secure-`-prefixed on HTTPS. Behind a TLS-terminating
  // proxy the request looks like plain HTTP, so check both names.
  for (const secureCookie of [false, true]) {
    const token = await getToken({ req, secret, secureCookie });
    if (token?.apiToken) return token.apiToken;
  }
  return null;
}
