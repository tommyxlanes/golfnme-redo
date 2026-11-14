// Lightweight health check — called by Docker HEALTHCHECK
// Verifies Redis is reachable (worker's only hard dependency)
const { createClient } = require("redis");

const url = process.env.REDIS_URL || "redis://localhost:6379";

const client = createClient({ url });

client.connect()
  .then(() => client.ping())
  .then((res) => {
    if (res === "PONG") {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch(() => process.exit(1))
  .finally(() => client.quit().catch(() => {}));
