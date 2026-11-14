import { prisma } from '@/lib/prisma'
import type { Score, Hole, User } from '@prisma/client'

export interface CreateScoreInput {
  roundId: string
  holeId: string
  userId: string
  strokes: number
  putts?: number
  fairwayHit?: boolean
  greenInReg?: boolean
  penalties?: number
}

export interface UpdateScoreInput {
  strokes?: number
  putts?: number
  fairwayHit?: boolean
  greenInReg?: boolean
  penalties?: number
}

export interface ScoreWithHole extends Score {
  hole: Hole
}

export interface ScoreWithHoleAndUser extends Score {
  hole: Hole
  user: Pick<User, 'id' | 'name' | 'username' | 'avatarUrl'>
}

export class ScoreRepository {
  async findById(id: string): Promise<Score | null> {
    return prisma.score.findUnique({
      where: { id },
    })
  }

  async findByRoundId(roundId: string): Promise<ScoreWithHole[]> {
    return prisma.score.findMany({
      where: { roundId },
      include: { hole: true },
      orderBy: { hole: { holeNumber: 'asc' } },
    })
  }

  async findByRoundIdWithUser(roundId: string): Promise<ScoreWithHoleAndUser[]> {
    return prisma.score.findMany({
      where: { roundId },
      include: {
        hole: true,
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { hole: { holeNumber: 'asc' } },
    })
  }

  async findByCompositeKey(
    roundId: string,
    holeId: string,
    userId: string
  ): Promise<ScoreWithHole | null> {
    return prisma.score.findUnique({
      where: {
        roundId_holeId_userId: {
          roundId,
          holeId,
          userId,
        },
      },
      include: { hole: true },
    })
  }

  async upsert(data: CreateScoreInput): Promise<ScoreWithHole> {
    return prisma.score.upsert({
      where: {
        roundId_holeId_userId: {
          roundId: data.roundId,
          holeId: data.holeId,
          userId: data.userId,
        },
      },
      update: {
        strokes: data.strokes,
        putts: data.putts,
        fairwayHit: data.fairwayHit,
        greenInReg: data.greenInReg,
        penalties: data.penalties ?? 0,
      },
      create: {
        roundId: data.roundId,
        holeId: data.holeId,
        userId: data.userId,
        strokes: data.strokes,
        putts: data.putts,
        fairwayHit: data.fairwayHit,
        greenInReg: data.greenInReg,
        penalties: data.penalties ?? 0,
      },
      include: { hole: true },
    })
  }

  async update(id: string, data: UpdateScoreInput): Promise<Score> {
    return prisma.score.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<void> {
    await prisma.score.delete({
      where: { id },
    })
  }

  async deleteByRoundId(roundId: string): Promise<void> {
    await prisma.score.deleteMany({
      where: { roundId },
    })
  }

  async countByRoundId(roundId: string): Promise<number> {
    return prisma.score.count({
      where: { roundId },
    })
  }

  /**
   * Calculate totals for a round based on all scores
   */
  async calculateRoundTotals(roundId: string): Promise<{
    totalScore: number
    totalPutts: number
    fairwaysHit: number
    greensInReg: number
    holesCompleted: number
  }> {
    const scores = await this.findByRoundId(roundId)

    const totalScore = scores.reduce((sum, s) => sum + s.strokes, 0)
    const totalPutts = scores.reduce((sum, s) => sum + (s.putts ?? 0), 0)
    const fairwaysHit = scores.filter(s => s.fairwayHit && s.hole.par >= 4).length
    const greensInReg = scores.filter(s => s.greenInReg).length

    return {
      totalScore,
      totalPutts,
      fairwaysHit,
      greensInReg,
      holesCompleted: scores.length,
    }
  }
}

// Singleton instance
export const scoreRepository = new ScoreRepository()
