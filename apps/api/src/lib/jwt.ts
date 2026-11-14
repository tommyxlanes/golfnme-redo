import { SignJWT, jwtVerify } from "jose";

// JWT_SECRET (when set and non-empty) wins; otherwise NEXTAUTH_SECRET, so tokens the old Next.js
// /api/auth/mobile/* routes issued stay valid after the split.
function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET (or NEXTAUTH_SECRET) must be set");
  }
  return new TextEncoder().encode(secret);
}

export interface AuthUser {
  id: string;
  email?: string;
  name?: string | null;
  username?: string | null;
}

export async function signAccessToken(user: AuthUser): Promise<string> {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifyAccessToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: payload.email as string | undefined,
      name: payload.name as string | null | undefined,
      username: payload.username as string | null | undefined,
    };
  } catch {
    return null;
  }
}
