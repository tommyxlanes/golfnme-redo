import { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      handicap: number | null;
      image?: string | null; // Explicit (already in DefaultSession but being clear)
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    username: string;
    handicap: number | null;
    // Bearer token for apps/api — set by the Credentials provider.
    apiToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    username: string | null;
    handicap: number | null;
    picture: string | null;
    // Bearer token for apps/api. Stays in the encrypted cookie; the session
    // callback does not copy it to the browser.
    apiToken?: string;
  }
}
