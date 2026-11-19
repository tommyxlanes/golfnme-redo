import { NextRequest, NextResponse } from "next/server";
import { API_URL, expireSessionCookies, getApiToken } from "@/lib/api";

// Forwards a request to the standalone API (apps/api) at the same path,
// adding the signed-in user's Bearer token from their NextAuth cookie.
//
// Clients that send their own Authorization header (the Expo app pointed at
// this host) are passed through untouched.

const FORWARDED_REQUEST_HEADERS = ["content-type", "accept", "x-forwarded-for", "x-real-ip"];
// fetch() already decoded the body, so these no longer describe it.
const DROPPED_RESPONSE_HEADERS = ["content-encoding", "content-length", "transfer-encoding", "connection"];

export async function proxy(req: NextRequest) {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  const ownAuthorization = req.headers.get("authorization");
  const sessionToken = ownAuthorization ? null : await getApiToken(req);
  const authorization = ownAuthorization ?? (sessionToken ? `Bearer ${sessionToken}` : null);
  if (authorization) headers.set("authorization", authorization);

  const hasBody = req.method !== "GET" && req.method !== "HEAD";

  let upstream: Response;
  try {
    upstream = await fetch(
      `${API_URL}${req.nextUrl.pathname}${req.nextUrl.search}`,
      {
        method: req.method,
        headers,
        body: hasBody ? await req.arrayBuffer() : undefined,
        redirect: "manual",
        cache: "no-store",
      },
    );
  } catch (error) {
    console.error(`[api-proxy] ${req.method} ${req.nextUrl.pathname}:`, error);
    return NextResponse.json({ error: "API unavailable" }, { status: 502 });
  }

  const responseHeaders = new Headers(upstream.headers);
  for (const name of DROPPED_RESPONSE_HEADERS) responseHeaders.delete(name);

  const res = new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });

  // The API rejected the token from this browser's session, so the session
  // is no use any more: sign the browser out rather than leave it looking
  // signed in while every request fails.
  if (sessionToken && upstream.status === 401) {
    expireSessionCookies(req, res);
  }

  return res;
}
