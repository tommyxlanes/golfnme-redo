import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authService } from "@/services";
import { userRepository } from "@/repositories";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  // PrismaAdapter manages the Account, Session, and VerificationToken
  // tables in Postgres. Required for Google OAuth account linking.
  adapter: PrismaAdapter(prisma),

  // JWT strategy is required when using the Credentials provider alongside
  // OAuth — the adapter is still used for Account/Session table writes.
  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID     ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // Tell the adapter to always link accounts to an existing user by email
      // rather than creating duplicates when the same email signs in via Google
      // after previously using credentials.
      allowDangerousEmailAccountLinking: true,
    }),

    Credentials({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const validated = loginSchema.safeParse(credentials);
        if (!validated.success) return null;

        const { email, password } = validated.data;
        const result = await authService.validateCredentials({ email, password });

        if (!result.success || !result.user) return null;

        return {
          id:       result.user.id,
          email:    result.user.email,
          name:     result.user.name,
          image:    result.user.avatarUrl,
          username: result.user.username,
          handicap: result.user.handicap,
        };
      },
    }),
  ],

  // events.createUser fires once when the PrismaAdapter creates a brand-new
  // User row — only happens on first Google sign-in for that email.
  // Use it to backfill the username (not set by the adapter).
  events: {
    async createUser({ user }) {
      if (!user.id || !user.email) return;

      // Only patch users that the adapter created without a username
      const dbUser = await prisma.user.findUnique({
        where:  { id: user.id },
        select: { username: true },
      });

      if (dbUser?.username) return; // already set

      // Generate a unique username from their name or email prefix
      const base = (user.name ?? user.email.split("@")[0])
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 15) || "golfer";

      let username = base;
      let attempt  = 0;
      while (await prisma.user.findUnique({ where: { username } })) {
        attempt++;
        username = `${base}${attempt}`;
      }

      await prisma.user.update({
        where: { id: user.id },
        data:  { username },
      });
    },
  },

  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      // Initial sign-in — hydrate the token from the DB user
      if (account && user) {
        if (user.email) {
          const dbUser = await userRepository.findByEmail(user.email);
          if (dbUser) {
            token.id       = dbUser.id;
            token.username = dbUser.username ?? "";
            token.handicap = dbUser.handicap ?? null;
            token.picture  = dbUser.avatarUrl ?? null;
            token.name     = dbUser.name;
            token.email    = dbUser.email;
            return token;
          }
        }

        // Credentials fallback (user object already has everything)
        token.id       = user.id ?? "";
        token.username = (user as any).username ?? "";
        token.handicap = (user as any).handicap ?? null;
        token.picture  = user.image ?? null;
      }

      // Session update trigger (e.g. profile edit)
      if (trigger === "update" && session) {
        token.name     = session.name;
        token.username = session.username ?? token.username;
        token.handicap = session.handicap ?? token.handicap;
        if (session.image) token.picture = session.image;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id       = (token.id       as string) ?? (token.sub as string) ?? "";
        session.user.username = (token.username as string) ?? "";
        session.user.handicap = (token.handicap as number) ?? null;
        session.user.image    = (token.picture  as string) ?? null;
      }
      return session;
    },
  },
});

// ─────────────────────────────────────────────
// Helpers (unchanged)
// ─────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return authService.hashPassword(password);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return authService.verifyPassword(password, hash);
}

export async function getServerSession() {
  return await auth();
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}
