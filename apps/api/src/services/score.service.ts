import {
  scoreRepository,
  roundRepository,
  type ScoreWithHole,
  type ScoreWithHoleAndUser,
} from '@/repositories'

export interface SaveScoreInput {
  roundId: string
  holeId: string
  userId: string
  strokes: number
  putts?: number
  fairwayHit?: boolean
  greenInReg?: boolean
  penalties?: number
}

export interface ScoreResult {
  success: boolean
  score?: ScoreWithHole
  roundTotals?: {
    totalScore: number
    totalPutts: number
    fairwaysHit: number
    greensInReg: number
    holesCompleted: number
  }
  error?: string
}

export interface ScoresResult {
  success: boolean
  scores?: ScoreWithHoleAndUser[]
  error?: string
}

export class ScoreService {
  async saveScore(input: SaveScoreInput): Promise<ScoreResult> {
    // Verify round exists and belongs to user
    const round = await roundRepository.findByIdWithDetails(input.roundId)

    if (!round) {
      return { success: false, error: 'Round not found' }
    }

    if (round.userId !== input.userId) {
      return { success: false, error: 'Not your round' }
    }

    if (round.status !== 'IN_PROGRESS') {
      return { success: false, error: 'Round is not in progress' }
    }

    // Verify hole belongs to the course
    const hole = round.course.holes.find(h => h.id === input.holeId)
    if (!hole) {
      return { success: false, error: 'Hole not found for this course' }
    }

    // Validate score
    if (input.strokes < 1 || input.strokes > 20) {
      return { success: false, error: 'Invalid stroke count' }
    }

    if (input.putts !== undefined && (input.putts < 0 || input.putts > 10)) {
      return { success: false, error: 'Invalid putt count' }
    }

    // Upsert score
    const score = await scoreRepository.upsert({
      roundId: input.roundId,
      holeId: input.holeId,
      userId: input.userId,
      strokes: input.strokes,
      putts: input.putts,
      fairwayHit: input.fairwayHit,
      greenInReg: input.greenInReg,
      penalties: input.penalties ?? 0,
    })

    // Calculate and update round totals
    const totals = await scoreRepository.calculateRoundTotals(input.roundId)

    await roundRepository.update(input.roundId, {
      totalScore: totals.totalScore,
      totalPutts: totals.totalPutts,
      fairwaysHit: totals.fairwaysHit,
      greensInReg: totals.greensInReg,
    })

    return {
      success: true,
      score,
      roundTotals: totals,
    }
  }

  async getScoresForRound(
    roundId: string,
    userId: string
  ): Promise<ScoresResult> {
    // Verify access to round
    const round = await roundRepository.findByIdWithDetails(roundId)

    if (!round) {
      return { success: false, error: 'Round not found' }
    }

    // User can view if it's their round OR if they're in the same session
    const isOwner = round.userId === userId
    const isSessionMember = round.session?.members?.some(m => m.userId === userId)
    const isSessionHost = round.session?.hostId === userId

    if (!isOwner && !isSessionMember && !isSessionHost) {
      return { success: false, error: 'Access denied' }
    }

    const scores = await scoreRepository.findByRoundIdWithUser(roundId)

    return { success: true, scores }
  }

  async deleteScore(
    scoreId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const score = await scoreRepository.findById(scoreId)

    if (!score) {
      return { success: false, error: 'Score not found' }
    }

    // Verify ownership through round
    const round = await roundRepository.findById(score.roundId)

    if (!round || round.userId !== userId) {
      return { success: false, error: 'Not your score' }
    }

    if (round.status !== 'IN_PROGRESS') {
      return { success: false, error: 'Cannot modify completed round' }
    }

    await scoreRepository.delete(scoreId)

    return { success: true }
  }
}

// Singleton instance
export const scoreService = new ScoreService()
