/**
 * src/lib/queue.ts
 *
 * Re-exports everything from worker/queues.ts so API routes
 * can import from a single, clean path:
 *
 *   import { dispatchStatsRecompute } from "@/lib/queue"
 *
 * The worker/ directory also imports directly from worker/queues.ts
 * to avoid the @/ alias dependency inside the worker process.
 */

export {
  dispatchStatsRecompute,
  dispatchHandicapRecompute,
  dispatchLeaderboardUpdate,
  dispatchSessionTimeoutCheck,
  dispatchNotification,
  statsQueue,
  sessionQueue,
  leaderboardQueue,
  notificationQueue,
} from "../../worker/queues";

export type {
  RecomputeUserStatsJob,
  RecomputeHandicapJob,
  LeaderboardUpdateJob,
  SessionTimeoutCheckJob,
  SendNotificationJob,
  NotificationKind,
} from "../../worker/queues";
