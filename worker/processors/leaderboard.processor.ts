import { Processor, Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import type { LeaderboardUpdateJob } from "../queues";
import type { LeaderboardEntry } from "@/types";

// ─────────────────────────────────────────────
// leaderboard-update
// Recomputes the full leaderboard for a group session and
// broadcasts it via Socket.io. Debounced at dispatch site (300ms)
// so rapid score entries don't hammer the DB.
// ─────────────────────────────────────────────
export const leaderboardUpdate: Processor<LeaderboardUpdateJob> = async (
  job: Job<LeaderboardUpdateJob>,
) => {
  const { sessionId, triggerUserId, holeNumber } = job.data;
  job.log(
    `Building leaderboard for session ${sessionId} ` +
      `(triggered by user ${triggerUserId}, hole ${holeNumber})`,
  );

  const session = await prisma.groupSession.findUnique({
    where: { id: sessionId },
    include: {
      course: { include: { holes: true } },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatarUrl: true,
              handicap: true,
            },
          },
        },
      },
      rounds: {
        where: { status: { in: ["IN_PROGRESS", "COMPLETED"] } },
        include: {
          scores: { include: { hole: true } },
          user: {
            select: { id: true, name: true, username: true, avatarUrl: true },
          },
        },
      },
    },
  });

  if (!session) {
    job.log("Session not found");
    return { sessionId, entries: 0 };
  }

  const coursePar = session.course.holes.reduce((sum, h) => sum + h.par, 0);

  // Build leaderboard entries
  const entries: LeaderboardEntry[] = session.rounds.map((round) => {
    const holesPlayed = round.scores.length;
    const totalStrokes = round.scores.reduce((sum, s) => sum + s.strokes, 0);
    const relativeToPar = holesPlayed > 0 ? totalStrokes - coursePar : 0;

    // Holes-in-progress par (for scoring-in-progress display)
    const playedPar = round.scores.reduce((sum, s) => sum + s.hole.par, 0);
    const currentRelative = holesPlayed > 0 ? totalStrokes - playedPar : 0;

    return {
      userId: round.user.id,
      playerName: round.user.name,
      totalScore: totalStrokes,
      holesPlayed,
      currentHole:
        holesPlayed + 1 <= session.course.numHoles
          ? holesPlayed + 1
          : session.course.numHoles,
      relativeToPar: currentRelative,
      isComplete: round.status === "COMPLETED",
      roundId: round.id,
    };
  });

  // Sort: completed rounds first (by score), then in-progress by relative-to-par
  entries.sort((a, b) => {
    if (a.isComplete && !b.isComplete) return -1;
    if (!a.isComplete && b.isComplete) return 1;
    return a.relativeToPar - b.relativeToPar;
  });

  // Assign positions (ties share position)
  let position = 1;
  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i].relativeToPar !== entries[i - 1].relativeToPar) {
      position = i + 1;
    }
    (entries[i] as LeaderboardEntry & { position: number }).position = position;
  }

  // Broadcast via Ably
  try {
    const { getAblyRest } = await import("@/lib/ably");
    const ably = getAblyRest();
    const channel = ably.channels.get(`session:${sessionId}:leaderboard`);
    await channel.publish("update", entries);
    job.log(`Leaderboard broadcast via Ably: ${entries.length} players`);
  } catch {
    job.log("Ably emit failed — leaderboard computed but not broadcast");
  }

  return {
    sessionId,
    entries: entries.length,
    holeNumber,
    leader: entries[0]?.playerName ?? null,
  };
};
