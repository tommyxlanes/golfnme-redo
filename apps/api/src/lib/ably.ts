import Ably from "ably";

export function getAblyRest(): Ably.Rest {
  if (!process.env.ABLY_API_KEY) {
    throw new Error("ABLY_API_KEY environment variable is not set");
  }
  return new Ably.Rest(process.env.ABLY_API_KEY);
}
