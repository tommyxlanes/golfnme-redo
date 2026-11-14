import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { decodeJwt } from "jose";
import { apiSignIn } from "@/lib/api";

// The web app holds no database connection. Users, passwords and Google
// account linking all live in the API (apps/api); NextAuth only runs the
// browser sign-in flow and keeps the API's Bearer token in its session
// cookie so /api/[...path] can forward requests on the user's behalf.

function isExpired(apiToken: string): boolean {
  try {
    const { exp } = decodeJwt(apiToken);
    return !!exp && exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),

    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const result = await apiSignIn(
          "/api/auth/login",
          { email, password },
          request.headers.get("x-forwarded-for"),
        );
        if (!result) return null;

        return {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          image: result.user.avatarUrl,
          username: result.user.username ?? "",
          handicap: result.user.handicap,
          apiToken: result.token,
        };
      },
    }),
  ],

  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith("golfnme://")) return url;
      if (url.includes("api/auth/mobile/callback")) return url;
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },

    async jwt({ token, user, account, trigger, session }) {
      // Google sign-in — trade Google's ID token for an API token. The API
      // verifies it and finds or creates the user by email.
      if (account?.provider === "google") {
        const result = account.id_token
          ? await apiSignIn("/api/auth/google", { idToken: account.id_token })
          : null;
        if (!result) throw new Error("Google sign-in was rejected by the API");

        token.id = result.user.id;
        token.username = result.user.username ?? "";
        token.handicap = result.user.handicap;
        token.picture = result.user.avatarUrl;
        token.name = result.user.name;
        token.email = result.user.email;
        token.apiToken = result.token;
        return token;
      }

      // Credentials sign-in — authorize() already called the API.
      if (account && user) {
        token.id = user.id ?? "";
        token.username = user.username ?? "";
        token.handicap = user.handicap ?? null;
        token.picture = user.image ?? null;
        token.apiToken = user.apiToken;
        return token;
      }

      // No usable API token (cookie from before the API split, or the token
      // ran out) — end the session so the user signs in again.
      if (!token.apiToken || isExpired(token.apiToken)) return null;

      // Session update trigger (e.g. profile edit)
      if (trigger === "update" && session) {
        token.name = session.name;
        token.username = session.username ?? token.username;
        token.handicap = session.handicap ?? token.handicap;
        if (session.image) token.picture = session.image;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? (token.sub as string) ?? "";
        session.user.username = (token.username as string) ?? "";
        session.user.handicap = (token.handicap as number) ?? null;
        session.user.image = (token.picture as string) ?? null;
      }
      return session;
    },
  },
});
