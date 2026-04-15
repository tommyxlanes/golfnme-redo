import {
  roundRepository,
  courseRepository,
  scoreRepository,
  sessionRepository,
  type RoundWithDetails,
  type RoundWithCourse,
  type PaginatedResult,
} from "@/repositories";
import type { RoundStatus } from "@prisma/client";

export interface CreateRoundInput {
  userId: string;
  courseId: string;
  sessionId?: string;
  weather?: string;
  notes?: string;
}

export interface RoundResult {
  success: boolean;
  round?: RoundWithDetails;
  error?: string;
}

export interface RoundsResult {
  success: boolean;
  data?: PaginatedResult<RoundWithCourse>;
  error?: string;
}

export interface RoundStats {
  coursePar: number;
  holesPlayed: number;
  scoreToPar: number | null;
  scoringBreakdown: {
    eagles: number;
    birdies: number;
    pars: number;
    bogeys: number;
    doubleBogeys: number;
    worse: number;
  };
  parPerformance: {
    par3: { count: number; totalStrokes: number; average: string | null };
    par4: { count: number; totalStrokes: number; average: string | null };
    par5: { count: number; totalStrokes: number; average: string | null };
  };
  fairwayPercentage: string | null;
  girPercentage: string | null;
  avgPutts: string | null;
}

export interface RoundWithStats extends RoundWithDetails {
  stats: RoundStats;
}

export class RoundService {
  async createRound(input: CreateRoundInput): Promise<RoundResult> {
    // Verify course exists
    const course = await courseRepository.findByIdWithHoles(input.courseId);
    if (!course) {
      return { success: false, error: "Course not found" };
    }

    // If joining a session, verify it exists and is valid
    if (input.sessionId) {
      const session = await sessionRepository.findByIdWithDetails(
        input.sessionId
      );

      if (!session) {
        return { success: false, error: "Session not found" };
      }

      if (session.status !== "WAITING" && session.status !== "IN_PROGRESS") {
        return { success: false, error: "Session is not active" };
      }

      // Check if user is a member or host
      const isMember = session.members.some((m) => m.userId === input.userId);
      const isHost = session.hostId === input.userId;

      if (!isMember && !isHost) {
        return { success: false, error: "Not a member of this session" };
      }
    }

    // Create round
    const round = await roundRepository.create(input);

    return { success: true, round };
  }

  async getRound(
    id: string,
    userId: string
  ): Promise<{ success: boolean; data?: RoundWithStats; error?: string }> {
    const round = await roundRepository.findByIdWithDetails(id);

    if (!round) {
      return { success: false, error: "Round not found" };
    }

    // Check access - owner or session member
    const isOwner = round.userId === userId;
    const isSessionMember = round.session?.members?.some(
      (m) => m.userId === userId
    );

    if (!isOwner && !isSessionMember) {
      return { success: false, error: "Access denied" };
    }

    // Calculate stats
    const stats = this.calculateRoundStats(round);

    return {
      success: true,
      data: { ...round, stats },
    };
  }

  async getUserRounds(
    userId: string,
    options?: {
      courseId?: string;
      status?: RoundStatus;
      take?: number;
      skip?: number;
    }
  ): Promise<RoundsResult> {
    const result = await roundRepository.findByUserId(userId, options);
    return { success: true, data: result };
  }

  async completeRound(id: string, userId: string): Promise<RoundResult> {
    const round = await roundRepository.findByIdWithDetails(id);

    if (!round) {
      return { success: false, error: "Round not found" };
    }

    if (round.userId !== userId) {
      return { success: false, error: "Not your round" };
    }

    if (round.status !== "IN_PROGRESS") {
      return { success: false, error: "Round is not in progress" };
    }

    // Calculate final totals
    const totals = await scoreRepository.calculateRoundTotals(id);

    const updatedRound = await roundRepository.updateWithDetails(id, {
      status: "COMPLETED",
      totalScore: totals.totalScore,
      totalPutts: totals.totalPutts,
      fairwaysHit: totals.fairwaysHit,
      greensInReg: totals.greensInReg,
    });

    // If this round is part of a session, check if session should complete
    if (round.sessionId) {
      await this.checkAndCompleteSession(round.sessionId);
    }

    return { success: true, round: updatedRound };
  }

  /**
   * Check if all rounds in a session are completed and complete the session if so
   */
  private async checkAndCompleteSession(sessionId: string): Promise<void> {
    const session = await sessionRepository.findByIdWithDetails(sessionId);

    if (!session || session.status !== "IN_PROGRESS") return;

    // Check if all rounds are completed
    const allRoundsCompleted = session.rounds?.every(
      (r) => r.status === "COMPLETED"
    );

    if (allRoundsCompleted && session.rounds && session.rounds.length > 0) {
      await sessionRepository.update(sessionId, {
        status: "COMPLETED",
        endedAt: new Date(),
      });
    }
  }

  async abandonRound(id: string, userId: string): Promise<RoundResult> {
    const round = await roundRepository.findById(id);

    if (!round) {
      return { success: false, error: "Round not found" };
    }

    if (round.userId !== userId) {
      return { success: false, error: "Not your round" };
    }

    const updatedRound = await roundRepository.updateWithDetails(id, {
      status: "ABANDONED",
    });

    return { success: true, round: updatedRound };
  }

  async updateRound(
    id: string,
    userId: string,
    data: { notes?: string; weather?: string }
  ): Promise<RoundResult> {
    const round = await roundRepository.findById(id);

    if (!round) {
      return { success: false, error: "Round not found" };
    }

    if (round.userId !== userId) {
      return { success: false, error: "Not your round" };
    }

    const updatedRound = await roundRepository.updateWithDetails(id, data);

    return { success: true, round: updatedRound };
  }

  async deleteRound(
    id: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const round = await roundRepository.findById(id);

    if (!round) {
      return { success: false, error: "Round not found" };
    }

    if (round.userId !== userId) {
      return { success: false, error: "Not your round" };
    }

    await roundRepository.delete(id);

    return { success: true };
  }

  /**
   * Calculate comprehensive stats for a round
   */
  private calculateRoundStats(round: RoundWithDetails): RoundStats {
    const coursePar = round.course.holes.reduce((sum, h) => sum + h.par, 0);
    const holesPlayed = round.scores.length;
    const scoreToPar = round.totalScore ? round.totalScore - coursePar : null;

    // Scoring breakdown
    const scoringBreakdown = {
      eagles: 0,
      birdies: 0,
      pars: 0,
      bogeys: 0,
      doubleBogeys: 0,
      worse: 0,
    };

    round.scores.forEach((score) => {
      const diff = score.strokes - score.hole.par;
      if (diff <= -2) scoringBreakdown.eagles++;
      else if (diff === -1) scoringBreakdown.birdies++;
      else if (diff === 0) scoringBreakdown.pars++;
      else if (diff === 1) scoringBreakdown.bogeys++;
      else if (diff === 2) scoringBreakdown.doubleBogeys++;
      else scoringBreakdown.worse++;
    });

    // Par performance
    const par3Holes = round.scores.filter((s) => s.hole.par === 3);
    const par4Holes = round.scores.filter((s) => s.hole.par === 4);
    const par5Holes = round.scores.filter((s) => s.hole.par === 5);

    const calculateAverage = (holes: typeof round.scores) => {
      if (holes.length === 0) return null;
      const total = holes.reduce((sum, s) => sum + s.strokes, 0);
      return (total / holes.length).toFixed(2);
    };

    const parPerformance = {
      par3: {
        count: par3Holes.length,
        totalStrokes: par3Holes.reduce((sum, s) => sum + s.strokes, 0),
        average: calculateAverage(par3Holes),
      },
      par4: {
        count: par4Holes.length,
        totalStrokes: par4Holes.reduce((sum, s) => sum + s.strokes, 0),
        average: calculateAverage(par4Holes),
      },
      par5: {
        count: par5Holes.length,
        totalStrokes: par5Holes.reduce((sum, s) => sum + s.strokes, 0),
        average: calculateAverage(par5Holes),
      },
    };

    // Fairways and greens percentages
    const eligibleFairways = round.scores.filter((s) => s.hole.par >= 4).length;
    const fairwayPercentage =
      eligibleFairways > 0
        ? (((round.fairwaysHit || 0) / eligibleFairways) * 100).toFixed(1)
        : null;

    const girPercentage =
      holesPlayed > 0
        ? (((round.greensInReg || 0) / holesPlayed) * 100).toFixed(1)
        : null;

    const avgPutts =
      holesPlayed > 0
        ? ((round.totalPutts || 0) / holesPlayed).toFixed(2)
        : null;

    return {
      coursePar,
      holesPlayed,
      scoreToPar,
      scoringBreakdown,
      parPerformance,
      fairwayPercentage,
      girPercentage,
      avgPutts,
    };
  }
}

// Singleton instance
export const roundService = new RoundService();
