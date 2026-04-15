import { roundRepository, type RoundWithDetails } from '@/repositories'
import { prisma } from '@/lib/prisma'
import {
  calculateHandicapDifferential,
  calculateHandicapIndex,
  calculateScoringDistribution,
  calculateParPerformance,
} from '@/lib/golf-utils'

export interface OverviewStats {
  totalRounds: number
  averageScore: number
  bestRound: number | null
  worstRound: number | null
  handicapIndex: number | null
  scoringDistribution: {
    eagles: number
    birdies: number
    pars: number
    bogeys: number
    doubleBogeys: number
    worse: number
  }
  parPerformance: {
    par3Average: number
    par4Average: number
    par5Average: number
  }
  fairwayPercentage: number
  girPercentage: number
  averagePutts: number
  recentScores: Array<{
    date: string
    score: number
    courseName: string
    par: number
  }>
}

export interface CourseStats {
  courseId: string
  courseName: string
  par: number
  roundsPlayed: number
  bestScore: number
  averageScore: number
  lastPlayed: Date
  scoreTrend: number[]
}

export interface TrendStats {
  scoreTrend: Array<{
    date: string
    score: number
    courseName: string
    scoreToPar: number
  }>
  handicapHistory: Array<{
    date: string
    handicap: number
  }>
  periodDays: number
}

export interface HeadToHeadStats {
  opponentId: string
  opponentName: string
  wins: number
  losses: number
  ties: number
  averageMargin: number
  lastMatchup: Date | null
  sharedRounds: Array<{
    date: Date
    yourScore: number
    theirScore: number
    courseName: string
    winner: 'you' | 'them' | 'tie'
  }>
}

export class StatsService {
  /**
   * Get overview stats for a user
   */
  async getOverviewStats(userId: string): Promise<OverviewStats> {
    const completedRounds = await roundRepository.findCompletedByUserId(userId)

    if (completedRounds.length === 0) {
      return this.emptyOverviewStats()
    }

    const scores = completedRounds
      .map(r => r.totalScore ?? 0)
      .filter(s => s > 0)

    const totalRounds = completedRounds.length
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length
    const bestRound = Math.min(...scores)
    const worstRound = Math.max(...scores)

    // Calculate handicap
    const differentials: number[] = []
    for (const round of completedRounds.slice(0, 20)) {
      if (round.course.rating && round.course.slope && round.totalScore) {
        const diff = calculateHandicapDifferential(
          round.totalScore,
          round.course.rating,
          round.course.slope
        )
        differentials.push(diff)
      }
    }
    const handicapIndex = calculateHandicapIndex(differentials)

    // Aggregate all scores for distribution
    const allScores = completedRounds.flatMap(r => r.scores)
    const allHoles = completedRounds.flatMap(r => r.course.holes)

    const scoringDistribution = calculateScoringDistribution(allScores, allHoles)
    const parPerformance = calculateParPerformance(allScores, allHoles)

    // Recent scores for chart
    const recentScores = completedRounds.slice(0, 10).map(r => ({
      date: r.playedAt.toISOString().split('T')[0],
      score: r.totalScore ?? 0,
      courseName: r.course.name,
      par: r.course.par,
    })).reverse()

    // Calculate GIR and fairway percentages
    const totalFairways = completedRounds.reduce((sum, r) => sum + (r.fairwaysHit ?? 0), 0)
    const totalFairwayHoles = completedRounds.reduce((sum, r) => {
      const par4Plus = r.course.holes.filter(h => h.par >= 4).length
      return sum + par4Plus
    }, 0)
    const fairwayPercentage = totalFairwayHoles > 0
      ? Math.round((totalFairways / totalFairwayHoles) * 100)
      : 0

    const totalGIR = completedRounds.reduce((sum, r) => sum + (r.greensInReg ?? 0), 0)
    const totalHoles = completedRounds.reduce((sum, r) => sum + r.course.numHoles, 0)
    const girPercentage = totalHoles > 0
      ? Math.round((totalGIR / totalHoles) * 100)
      : 0

    const totalPutts = completedRounds.reduce((sum, r) => sum + (r.totalPutts ?? 0), 0)
    const averagePutts = totalRounds > 0
      ? Math.round((totalPutts / totalRounds) * 10) / 10
      : 0

    return {
      totalRounds,
      averageScore: Math.round(averageScore * 10) / 10,
      bestRound,
      worstRound,
      handicapIndex,
      scoringDistribution,
      parPerformance,
      fairwayPercentage,
      girPercentage,
      averagePutts,
      recentScores,
    }
  }

  /**
   * Get stats grouped by course
   */
  async getCourseStats(userId: string, courseId?: string): Promise<CourseStats[]> {
    const rounds = await roundRepository.findCompletedByUserId(userId, {
      courseId,
    })

    // Group by course
    const courseMap = new Map<string, typeof rounds>()
    for (const round of rounds) {
      const existing = courseMap.get(round.courseId) || []
      existing.push(round)
      courseMap.set(round.courseId, existing)
    }

    return Array.from(courseMap.entries()).map(([id, courseRounds]) => {
      const scores = courseRounds
        .map(r => r.totalScore ?? 0)
        .filter(s => s > 0)
      const course = courseRounds[0].course

      return {
        courseId: id,
        courseName: course.name,
        par: course.par,
        roundsPlayed: courseRounds.length,
        bestScore: Math.min(...scores),
        averageScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
        lastPlayed: courseRounds[0].playedAt,
        scoreTrend: scores.slice(0, 5).reverse(),
      }
    }).sort((a, b) => b.roundsPlayed - a.roundsPlayed)
  }

  /**
   * Get trend stats over time
   */
  async getTrendStats(userId: string, periodDays: number = 90): Promise<TrendStats> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - periodDays)

    const rounds = await roundRepository.findCompletedByUserId(userId, {
      since: startDate,
    })

    // Sort by date ascending for trends
    rounds.sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime())

    const scoreTrend = rounds.map(r => ({
      date: r.playedAt.toISOString().split('T')[0],
      score: r.totalScore ?? 0,
      courseName: r.course.name,
      scoreToPar: (r.totalScore ?? 0) - r.course.par,
    }))

    // Calculate rolling handicap
    const handicapHistory: { date: string; handicap: number }[] = []
    const differentials: number[] = []

    for (const round of rounds) {
      if (round.course.rating && round.course.slope && round.totalScore) {
        const diff = calculateHandicapDifferential(
          round.totalScore,
          round.course.rating,
          round.course.slope
        )
        differentials.push(diff)

        if (differentials.length >= 3) {
          const handicap = calculateHandicapIndex(differentials.slice(-20))
          handicapHistory.push({
            date: round.playedAt.toISOString().split('T')[0],
            handicap,
          })
        }
      }
    }

    return {
      scoreTrend,
      handicapHistory,
      periodDays,
    }
  }

  /**
   * Get head-to-head stats against another player
   */
  async getHeadToHeadStats(
    userId: string,
    opponentId: string
  ): Promise<HeadToHeadStats | null> {
    // Find rounds where both users played in same session
    const sharedSessions = await prisma.groupSession.findMany({
      where: {
        status: 'COMPLETED',
        members: {
          some: { userId },
        },
        AND: {
          members: {
            some: { userId: opponentId },
          },
        },
      },
      include: {
        rounds: {
          where: {
            userId: { in: [userId, opponentId] },
            status: 'COMPLETED',
          },
          include: {
            user: {
              select: { id: true, name: true, username: true },
            },
          },
        },
        course: true,
      },
      orderBy: { startedAt: 'desc' },
    })

    if (sharedSessions.length === 0) {
      return null
    }

    let wins = 0
    let losses = 0
    let ties = 0
    const margins: number[] = []

    const sharedRounds = sharedSessions
      .map(session => {
        const myRound = session.rounds.find(r => r.userId === userId)
        const theirRound = session.rounds.find(r => r.userId === opponentId)

        if (myRound?.totalScore && theirRound?.totalScore) {
          const margin = myRound.totalScore - theirRound.totalScore
          margins.push(margin)

          if (margin < 0) wins++
          else if (margin > 0) losses++
          else ties++

          return {
            date: session.startedAt!,
            yourScore: myRound.totalScore,
            theirScore: theirRound.totalScore,
            courseName: session.course.name,
            winner: (margin < 0 ? 'you' : margin > 0 ? 'them' : 'tie') as 'you' | 'them' | 'tie',
          }
        }
        return null
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    const opponent = await prisma.user.findUnique({
      where: { id: opponentId },
      select: { id: true, name: true, username: true },
    })

    return {
      opponentId,
      opponentName: opponent?.name ?? 'Unknown',
      wins,
      losses,
      ties,
      averageMargin: margins.length > 0
        ? Math.round((margins.reduce((a, b) => a + b, 0) / margins.length) * 10) / 10
        : 0,
      lastMatchup: sharedRounds[0]?.date ?? null,
      sharedRounds,
    }
  }

  private emptyOverviewStats(): OverviewStats {
    return {
      totalRounds: 0,
      averageScore: 0,
      bestRound: null,
      worstRound: null,
      handicapIndex: null,
      scoringDistribution: {
        eagles: 0,
        birdies: 0,
        pars: 0,
        bogeys: 0,
        doubleBogeys: 0,
        worse: 0,
      },
      parPerformance: {
        par3Average: 0,
        par4Average: 0,
        par5Average: 0,
      },
      fairwayPercentage: 0,
      girPercentage: 0,
      averagePutts: 0,
      recentScores: [],
    }
  }
}

// Singleton instance
export const statsService = new StatsService()
