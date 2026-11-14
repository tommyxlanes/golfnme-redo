import Ably from "ably";

let ablyClient: Ably.Realtime | null = null;

export function getAblyClient(): Ably.Realtime {
  if (!ablyClient) {
    ablyClient = new Ably.Realtime({
      // Proxied to the API by app/api/[...path]/route.ts
      authUrl: "/api/ably-token",
      authMethod: "GET",
    });
  }
  return ablyClient;
}
