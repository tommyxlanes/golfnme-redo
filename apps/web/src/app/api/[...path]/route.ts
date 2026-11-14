// Everything under /api that is not NextAuth goes to the standalone API.
export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE } from "@/lib/api-proxy";
export const dynamic = "force-dynamic";
