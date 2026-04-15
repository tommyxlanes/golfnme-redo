import { Processor, Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { emitToSession } from "@/lib/socket";
import type {
  SessionTimeoutCheckJob,
  StaleSessionCleanupJob,
} from "../queues";

// Session auto-timeout thresholds
const SESSION_WAITING_TIMEOUT_MS  = 60 * 60 * 1000;  // 1h — lobby that never started
const SESSION_ACTIVE_TIMEOUT_MS   = 8 * 60 * 60 * 1000;  // 8h — round running too long

// ─────────────────────────────────────────────
// session-timeout-check
// Check if a specific session has gone stale and should be auto-closed.
// Dispatched when a session starts WAITING, and again when it goes IN_PROGRESS.
// ─────────────────────────────────────────────
export const sessionTimeoutCheck: Processor<SessionTimeoutCheckJob> = async (
  job: Job<SessionTimeoutCheckJob>
) => {
  const { sessionId } = job.data;
  job.log(`Checking timeout for session ${sessionId}`);

  const session = await prisma.groupSession.findUnique({
    where: { id: sessionId },
    include: { members: true, rounds: true },
  });

  if (!session) {
    job.log("Session not found — skipped");
    return { sessionId, action: "not_found" };
  }

  if (session.status === "COMPLETED" || session.status === "CANCELLED") {
    job.log(`Session already ${session.status} — nothing to do`);
    return { sessionId, action: "already_terminal" };
  }

  const ageMs = Date.now() - session.createdAt.getTime();
  const activeAgeMs = session.startedAt
    ? Date.now() - session.startedAt.getTime()
    : null;

  let shouldCancel = false;
  let reason = "";

  if (session.status === "WAITING" && ageMs > SESSION_WAITING_TIMEOUT_MS) {
    shouldCancel = true;
    reason = "lobby_timeout";
  } else if (
    session.status === "IN_PROGRESS" &&
    activeAgeMs != null &&
    activeAgeMs > SESSION_ACTIVE_TIMEOUT_MS
  ) {
    shouldCancel = true;
    reason = "active_timeout";
  }

  if (!shouldCancel) {
    return { sessionId, action: "still_active", ageMs };
  }

  // Mark all in-progress rounds as ABANDONED
  await prisma.round.updateMany({
    where: { sessionId, status: "IN_PROGRESS" },
    data:  { status: "ABANDONED" },
  });

  // Cancel the session
  await prisma.groupSession.update({
    where: { id: sessionId },
    data:  { status: "CANCELLED", endedAt: new Date() },
  });

  // Notify connected clients via Socket.io
  try {
    emitToSession(sessionId, "session-status-changed", {
      status: "CANCELLED",
      reason,
    });
  } catch {
    // Socket.io server may not be reachable from worker in all configs
    // That's ok — clients will pick up status on next poll/reconnect
    job.log("Socket.io emit failed (expected if Socket.io is app-only)");
  }

  job.log(`Session ${sessionId} cancelled: ${reason}`);
  return { sessionId, action: "cancelled", reason };
};

// ─────────────────────────────────────────────
// stale-session-cleanup
// Bulk cleanup run on a cron schedule.
// Catches any sessions that slipped through individual timeout checks.
// ─────────────────────────────────────────────
export const staleSessionCleanup: Processor<StaleSessionCleanupJob> = async (
  job: Job<StaleSessionCleanupJob>
) => {
  const { olderThanMs } = job.data;
  const cutoff = new Date(Date.now() - olderThanMs);
  job.log(`Running stale session cleanup — cutoff: ${cutoff.toISOString()}`);

  // Cancel WAITING sessions older than cutoff
  const cancelledWaiting = await prisma.groupSession.updateMany({
    where: {
      status:    "WAITING",
      createdAt: { lt: cutoff },
    },
    data: { status: "CANCELLED", endedAt: new Date() },
  });

  // For IN_PROGRESS sessions past the active timeout threshold,
  // first abandon their rounds, then cancel
  const staleActive = await prisma.groupSession.findMany({
    where: {
      status:    "IN_PROGRESS",
      startedAt: { lt: new Date(Date.now() - SESSION_ACTIVE_TIMEOUT_MS) },
    },
    select: { id: true },
  });

  let cancelledActive = 0;
  for (const s of staleActive) {
    await prisma.round.updateMany({
      where: { sessionId: s.id, status: "IN_PROGRESS" },
      data:  { status: "ABANDONED" },
    });
    await prisma.groupSession.update({
      where: { id: s.id },
      data:  { status: "CANCELLED", endedAt: new Date() },
    });
    cancelledActive++;
  }

  job.log(
    `Cleanup complete: ${cancelledWaiting.count} waiting, ${cancelledActive} active cancelled`
  );
  return {
    cancelledWaiting: cancelledWaiting.count,
    cancelledActive,
    cutoff: cutoff.toISOString(),
  };
};
