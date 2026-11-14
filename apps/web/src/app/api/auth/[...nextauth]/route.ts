import { handlers } from "@/lib/auth";

// Credentials logins are rate limited by the API's /api/auth/login, which
// the Credentials provider calls with the browser's IP forwarded.
export const { GET, POST } = handlers;
