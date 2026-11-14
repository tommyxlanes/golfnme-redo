// Listed explicitly so /api/auth/[...nextauth] does not swallow it.
export { proxy as POST } from "@/lib/api-proxy";
export const dynamic = "force-dynamic";
