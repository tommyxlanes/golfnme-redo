import { NextRequest } from "next/server";
import { getApiToken } from "@/lib/api";

const DEFAULT_RETURN = "golfnme://login";

// Where to send the token. The app passes its own deep link as ?redirect=:
// golfnme://… in a real build, exp://… when it runs inside Expo Go. Anything
// else is ignored — this URL carries a session token, so it must only ever
// go back to the app. exp:// can point at any Expo project, so it is
// accepted in development only.
function returnUrl(req: NextRequest): string {
  const requested = req.nextUrl.searchParams.get("redirect");
  if (!requested) return DEFAULT_RETURN;
  if (requested.startsWith("golfnme://")) return requested;
  if (process.env.NODE_ENV !== "production" && requested.startsWith("exp://")) {
    return requested;
  }
  return DEFAULT_RETURN;
}

function withParam(url: string, key: string, value: string) {
  return `${url}${url.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Mobile browsers refuse to jump from a plain HTTP redirect into an app
// unless the user tapped something (Chrome shows a blank page instead), so
// this is a page: it tries the app link straight away and keeps a button on
// screen for when the automatic attempt is blocked.
function handOffPage(target: string, ok: boolean) {
  const href = escapeHtml(target);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Return to GolfnMe</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; padding: 24px; box-sizing: border-box; background: #1c1a15; color: #fff; font-family: system-ui, sans-serif; text-align: center; }
  h1 { font-size: 22px; margin: 0; }
  p { color: #9ca3af; margin: 0; font-size: 15px; }
  a { display: block; width: 100%; max-width: 320px; box-sizing: border-box; padding: 16px; border-radius: 14px; background: #c9a227; color: #1c1a15; font-weight: 700; font-size: 16px; text-decoration: none; }
</style>
</head>
<body>
  <h1>${ok ? "You're signed in" : "Sign in didn't complete"}</h1>
  <p>${ok ? "Tap below if the app doesn't open by itself." : "Go back to the app and try again."}</p>
  <a id="open" href="${href}">Return to GolfnMe</a>
  <script>location.replace(document.getElementById("open").href);</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // The page embeds a session token
      "Cache-Control": "no-store",
    },
  });
}

// ── GET /api/auth/mobile/callback ─────────────────────────────────────────
// The mobile app opens the web Google sign-in in a browser with this URL as
// the callback. By the time we get here NextAuth has a session whose cookie
// holds the user's API token — hand that to the app via its deep link.
//
// (Native Google Sign-In can skip the browser entirely: POST the Google ID
// token to the API's /api/auth/google.)
export async function GET(req: NextRequest) {
  const target = returnUrl(req);
  try {
    const token = await getApiToken(req);

    if (!token) {
      return handOffPage(withParam(target, "error", "not_authenticated"), false);
    }

    return handOffPage(withParam(target, "token", token), true);
  } catch (error) {
    console.error("Mobile callback error:", error);
    return handOffPage(withParam(target, "error", "server_error"), false);
  }
}
