import Ably from "ably";

let ablyClient: Ably.Realtime | null = null;

export function getAblyClient(): Ably.Realtime {
  if (!ablyClient) {
    ablyClient = new Ably.Realtime({
      authUrl: "/api/ably-token",
      authMethod: "GET",
    });
  }
  return ablyClient;
}

// For server-side usage
export function getAblyRest(): Ably.Rest {
  if (!process.env.ABLY_API_KEY) {
    throw new Error("ABLY_API_KEY environment variable is not set");
  }
  return new Ably.Rest(process.env.ABLY_API_KEY);
}
