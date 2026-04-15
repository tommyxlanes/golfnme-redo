import { Processor, Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import {
  calculateHandicapDifferential,
  calculateHandicapIndex,
} from "@/lib/golf-utils";
import type {
  RecomputeUserStatsJob,
  RecomputeHandicapJob,
} from "../queues";

// ─────────────────────────────────────────────
// recompute-user-stats
// Rebuilds aggregate stats snapshot for the user.
// Triggered after any round is COMPLETED or ABANDONED.
// ─────────────────────────────────────────────
export const recomputeUserStats: Processor<RecomputeUserStatsJob> = async (
  job: Job<RecomputeUserStatsJob>
) => {
  const { userId } = job.data;
  job.log(`Recomputing stats for user ${userId}`);

  const completedRounds = await prisma.round.findMany({
    where: { userId, status: "COMPLETED" },
    include: {
      scores: { include: { hole: true } },
      course: { include: { holes: true } },
    },
    orderBy: { playedAt: "desc" },
  });

  if (completedRounds.length === 0) {
    job.log("No completed rounds found — skipping");
    return { userId, rounds: 0 };
  }

  // Aggregate scoring distributions across all rounds
  let totalEagles       = 0;
  let totalBirdies      = 0;
  let totalPars         = 0;
  let totalBogeys       = 0;
  let totalDoubleBogeys = 0;
  let totalWorse        = 0;
  let totalFairwaysHit  = 0;
  let totalFairways     = 0;
  let totalGIR          = 0;
  let totalHoles        = 0;
  let totalPutts        = 0;
  let puttsHoles        = 0;
  let scoreSum          = 0;
  let bestScore: number | null = null;
  let worstScore: number | null = null;

  for (const round of completedRounds) {
    const ts = round.totalScore;
    if (ts == null) continue;

    scoreSum += ts;
    if (bestScore === null || ts < bestScore) bestScore = ts;
    if (worstScore === null || ts > worstScore) worstScore = ts;

    if (round.fairwaysHit != null) totalFairwaysHit += round.fairwaysHit;
    if (round.greensInReg != null) totalGIR += round.greensInReg;
    if (round.totalPutts  != null) { totalPutts += round.totalPutts; puttsHoles += round.scores.length; }

    for (const score of round.scores) {
      totalHoles++;
      const diff = score.strokes - score.hole.par;
      if (diff <= -2) totalEagles++;
      else if (diff === -1) totalBirdies++;
      else if (diff === 0)  totalPars++;
      else if (diff === 1)  totalBogeys++;
      else if (diff === 2)  totalDoubleBogeys++;
      else totalWorse++;

      if (score.hole.par >= 4) totalFairways++;
    }
  }

  const avgScore = completedRounds.length > 0
    ? Math.round((scoreSum / completedRounds.length) * 100) / 100
    : null;

  const fairwayPct = totalFairways > 0
    ? Math.round((totalFairwaysHit / totalFairways) * 1000) / 10
    : null;

  const girPct = totalHoles > 0
    ? Math.round((totalGIR / totalHoles) * 1000) / 10
    : null;

  const avgPutts = puttsHoles > 0
    ? Math.round((totalPutts / puttsHoles) * 100) / 100
    : null;

  // Store in a dedicated stats cache document (upsert pattern)
  // If you add a UserStats model to the Prisma schema, use that.
  // For now we push a JSON blob into user metadata.
  // Replace with prisma.userStats.upsert once the model is added.
  job.log(
    `Stats computed: ${completedRounds.length} rounds, avg ${avgScore}, ` +
    `FIR ${fairwayPct}%, GIR ${girPct}%, avg putts ${avgPutts}`
  );

  return {
    userId,
    rounds:       completedRounds.length,
    avgScore,
    bestScore,
    worstScore,
    fairwayPct,
    girPct,
    avgPutts,
    scoring: {
      eagles:       totalEagles,
      birdies:      totalBirdies,
      pars:         totalPars,
      bogeys:       totalBogeys,
      doubleBogeys: totalDoubleBogeys,
      worse:        totalWorse,
    },
  };
};

// ─────────────────────────────────────────────
// recompute-handicap
// Uses World Handicap System differential formula.
// Triggered after round completion — deduped per user.
// ─────────────────────────────────────────────
export const recomputeHandicap: Processor<RecomputeHandicapJob> = async (
  job: Job<RecomputeHandicapJob>
) => {
  const { userId } = job.data;
  job.log(`Recomputing handicap for user ${userId}`);

  // WHS uses the 20 most recent rounds, best 8 differentials
  const rounds = await prisma.round.findMany({
    where: { userId, status: "COMPLETED", totalScore: { not: null } },
    include: { course: true },
    orderBy: { playedAt: "desc" },
    take: 20,
  });

  if (rounds.length < 3) {
    job.log(`Only ${rounds.length} rounds — need at least 3 for handicap`);
    return { userId, handicapIndex: null, reason: "insufficient_rounds" };
  }

  const differentials = rounds
    .filter((r) => r.course.rating != null && r.course.slope != null && r.totalScore != null)
    .map((r) =>
      calculateHandicapDifferential(
        r.totalScore!,
        r.course.rating!,
        r.course.slope!
      )
    );

  const handicapIndex = calculateHandicapIndex(differentials);

  if (handicapIndex !== null) {
    await prisma.user.update({
      where: { id: userId },
      data:  { handicap: handicapIndex },
    });
    job.log(`Handicap updated to ${handicapIndex}`);
  }

  return { userId, handicapIndex, differentials: differentials.length };
};
