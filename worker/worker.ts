import { Worker, WorkerOptions } from "bullmq";
import {
  QUEUE_NAMES,
  redisConnection,
  dispatchStaleSessionCleanup,
} from "./queues";

// Processors
import { recomputeUserStats, recomputeHandicap }  from "./processors/stats.processor";
import { sessionTimeoutCheck, staleSessionCleanup } from "./processors/session.processor";
import { leaderboardUpdate }                        from "./processors/leaderboard.processor";
import { sendNotification }                         from "./processors/notification.processor";

// ─────────────────────────────────────────────
// Shared worker options
// ─────────────────────────────────────────────
const baseOpts: WorkerOptions = {
  connection: redisConnection,
  concurrency: 5,
};

// ─────────────────────────────────────────────
// Stats worker
// Handles: recompute-user-stats, recompute-handicap
// ─────────────────────────────────────────────
const statsWorker = new Worker(
  QUEUE_NAMES.STATS,
  async (job) => {
    switch (job.name) {
      case "recompute-user-stats": return recomputeUserStats(job);
      case "recompute-handicap":   return recomputeHandicap(job);
      default:
        throw new Error(`Unknown stats job: ${job.name}`);
    }
  },
  { ...baseOpts, concurrency: 3 }
);

// ─────────────────────────────────────────────
// Session worker
// Handles: session-timeout-check, stale-session-cleanup
// Lower concurrency — each job does multiple DB writes
// ─────────────────────────────────────────────
const sessionWorker = new Worker(
  QUEUE_NAMES.SESSION,
  async (job) => {
    switch (job.name) {
      case "session-timeout-check":  return sessionTimeoutCheck(job);
      case "stale-session-cleanup":  return staleSessionCleanup(job);
      default:
        throw new Error(`Unknown session job: ${job.name}`);
    }
  },
  { ...baseOpts, concurrency: 2 }
);

// ─────────────────────────────────────────────
// Leaderboard worker
// Handles: leaderboard-update
// Single concurrency — emits to Socket.io, order matters
// ─────────────────────────────────────────────
const leaderboardWorker = new Worker(
  QUEUE_NAMES.LEADERBOARD,
  async (job) => {
    switch (job.name) {
      case "leaderboard-update": return leaderboardUpdate(job);
      default:
        throw new Error(`Unknown leaderboard job: ${job.name}`);
    }
  },
  { ...baseOpts, concurrency: 4 }
);

// ─────────────────────────────────────────────
// Notification worker
// Handles: send-notification
// ─────────────────────────────────────────────
const notificationWorker = new Worker(
  QUEUE_NAMES.NOTIFICATION,
  async (job) => {
    switch (job.name) {
      case "send-notification": return sendNotification(job);
      default:
        throw new Error(`Unknown notification job: ${job.name}`);
    }
  },
  { ...baseOpts, concurrency: 10 }
);

const allWorkers = [statsWorker, sessionWorker, leaderboardWorker, notificationWorker];

// ─────────────────────────────────────────────
// Shared logging
// ─────────────────────────────────────────────
for (const worker of allWorkers) {
  worker.on("completed", (job) => {
    console.log(`[${worker.name}] ✓ ${job.name} (${job.id})`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[${worker.name}] ✗ ${job?.name} (${job?.id}) — ${err.message}`,
      { attempts: job?.attemptsMade, data: job?.data }
    );
  });

  worker.on("error", (err) => {
    console.error(`[${worker.name}] worker error:`, err);
  });
}

// ─────────────────────────────────────────────
// Recurring jobs — register on startup
// ─────────────────────────────────────────────
async function registerRecurringJobs() {
  // Stale session sweep — every hour
  await dispatchStaleSessionCleanup();
  console.log("[worker] Recurring jobs registered");
}

// ─────────────────────────────────────────────
// Graceful shutdown
// ─────────────────────────────────────────────
async function shutdown(signal: string) {
  console.log(`[worker] ${signal} received — shutting down gracefully`);
  await Promise.all(allWorkers.map((w) => w.close()));
  console.log("[worker] All workers closed");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

// ─────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────
console.log("[worker] Starting BullMQ workers...");
console.log(`[worker] Redis: ${redisConnection.host}:${redisConnection.port}`);

registerRecurringJobs()
  .then(() => {
    console.log("[worker] Ready");
    allWorkers.forEach((w) => console.log(`  · ${w.name} (concurrency: ${w.opts.concurrency})`));
  })
  .catch((err) => {
    console.error("[worker] Failed to register recurring jobs:", err);
    process.exit(1);
  });
