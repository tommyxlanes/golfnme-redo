import "./instrument"; // must stay first
import { serve } from "@hono/node-server";
import { app } from "./app";
import { prisma } from "./lib/prisma";

// Static imports on purpose: `tsx watch` only restarts on changes to files
// it can see in the import graph, and it does not follow dynamic import().

// PORT is the web app's in the shared .env, so the API reads API_PORT first.
const port = parseInt(process.env.API_PORT || "4000", 10);

const server = serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
  console.log(`> golfnme API ready on http://localhost:${port}/api`);
});

const shutdown = (signal: string) => {
  console.log(`[api] ${signal} received — shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
