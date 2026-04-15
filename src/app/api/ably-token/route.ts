import { NextResponse } from "next/server";
import Ably from "ably";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.ABLY_API_KEY) {
      console.error("ABLY_API_KEY is not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const client = new Ably.Rest(process.env.ABLY_API_KEY);

    const tokenRequest = await client.auth.createTokenRequest({
      clientId: session.user.id,
      capability: {
        // Allow publish/subscribe to session channels
        "session:*": ["publish", "subscribe", "presence"],
      },
    });

    return NextResponse.json(tokenRequest);
  } catch (error) {
    console.error("Ably token error:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}
