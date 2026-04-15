import { Queue, QueueOptions } from "bullmq";

// ─────────────────────────────────────────────
// Connection config
// ─────────────────────────────────────────────
export const redisConnection = {
  host: process.env.REDIS_URL
    ? new URL(process.env.REDIS_URL).hostname
    : "localhost",
  port: process.env.REDIS_URL
    ? parseInt(new URL(process.env.REDIS_URL).port || "6379")
    : 6379,
};

const defaultOpts: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,   // keep last 100 completed jobs for inspection
    removeOnFail: 500,       // keep last 500 failed jobs for debugging
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
};

// ─────────────────────────────────────────────
// Queue names — single source of truth
// ─────────────────────────────────────────────
export const QUEUE_NAMES = {
  STATS:        "stats",
  SESSION:      "session",
  LEADERBOARD:  "leaderboard",
  NOTIFICATION: "notification",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ─────────────────────────────────────────────
// Queue instances
// Used from API routes to dispatch jobs
// ─────────────────────────────────────────────
export const statsQueue        = new Queue(QUEUE_NAMES.STATS,        defaultOpts);
export const sessionQueue      = new Queue(QUEUE_NAMES.SESSION,      defaultOpts);
export const leaderboardQueue  = new Queue(QUEUE_NAMES.LEADERBOARD,  defaultOpts);
export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, defaultOpts);

// ─────────────────────────────────────────────
// Job payload types
// ─────────────────────────────────────────────

// stats queue
export interface RecomputeUserStatsJob {
  userId: string;
}
export interface RecomputeHandicapJob {
  userId: string;
}

// session queue
export interface SessionTimeoutCheckJob {
  sessionId: string;
}
export interface StaleSessionCleanupJob {
  olderThanMs: number;
}

// leaderboard queue
export interface LeaderboardUpdateJob {
  sessionId: string;
  triggerUserId: string;   // who submitted the score that triggered this
  holeNumber: number;
}

// notification queue
export type NotificationKind =
  | "friend_request"
  | "friend_accepted"
  | "session_invite"
  | "session_started"
  | "round_complete";

export interface SendNotificationJob {
  kind: NotificationKind;
  recipientId: string;
  actorId?: string;
  sessionId?: string;
  roundId?: string;
  meta?: Record<string, string | number | boolean>;
}

// ─────────────────────────────────────────────
// Convenience dispatchers
// Call these from API routes — never new Queue() inline
// ─────────────────────────────────────────────

export async function dispatchStatsRecompute(userId: string) {
  return statsQueue.add(
    "recompute-user-stats",
    { userId } satisfies RecomputeUserStatsJob,
    { jobId: `stats:${userId}` }  // dedup — only one pending stats job per user
  );
}

export async function dispatchHandicapRecompute(userId: string) {
  return statsQueue.add(
    "recompute-handicap",
    { userId } satisfies RecomputeHandicapJob,
    { jobId: `handicap:${userId}` }
  );
}

export async function dispatchLeaderboardUpdate(
  sessionId: string,
  triggerUserId: string,
  holeNumber: number
) {
  return leaderboardQueue.add(
    "leaderboard-update",
    { sessionId, triggerUserId, holeNumber } satisfies LeaderboardUpdateJob,
    {
      // Debounce: replace any pending update for this session
      jobId: `leaderboard:${sessionId}`,
      delay: 300,  // 300ms debounce — batch rapid score submissions
    }
  );
}

export async function dispatchSessionTimeoutCheck(
  sessionId: string,
  delayMs = 0
) {
  return sessionQueue.add(
    "session-timeout-check",
    { sessionId } satisfies SessionTimeoutCheckJob,
    {
      jobId: `session-timeout:${sessionId}`,
      delay: delayMs,
    }
  );
}

export async function dispatchStaleSessionCleanup() {
  return sessionQueue.add(
    "stale-session-cleanup",
    { olderThanMs: 24 * 60 * 60 * 1000 } satisfies StaleSessionCleanupJob,
    { repeat: { every: 60 * 60 * 1000 } }  // every hour
  );
}

export async function dispatchNotification(job: SendNotificationJob) {
  return notificationQueue.add("send-notification", job);
}
