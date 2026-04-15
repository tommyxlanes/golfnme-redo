import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { scoreService } from '@/services'
import { dispatchLeaderboardUpdate } from '@/lib/queue'
import { z } from 'zod'

const updateScoreSchema = z.object({
  roundId:    z.string(),
  holeId:     z.string(),
  strokes:    z.number().int().min(1).max(20),
  putts:      z.number().int().min(0).max(10).optional(),
  fairwayHit: z.boolean().optional(),
  greenInReg: z.boolean().optional(),
  penalties:  z.number().int().min(0).default(0),
  holeNumber: z.number().int().min(1).max(18).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const validation = updateScoreSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors }, { status: 400 })
    }
    const result = await scoreService.saveScore({
      userId: session.user.id,
      ...validation.data,
    })
    if (!result.success) {
      const status = result.error === 'Round not found' ? 404
        : result.error === 'Not your round' ? 403 : 400
      return NextResponse.json({ error: result.error }, { status })
    }
    // Debounced leaderboard update for group sessions
    if ((result.score as any)?.round?.sessionId) {
      await dispatchLeaderboardUpdate(
        (result.score as any).round.sessionId,
        session.user.id,
        validation.data.holeNumber ?? 0
      )
    }
    return NextResponse.json({
      success: true,
      data: { score: result.score, roundTotals: result.roundTotals },
    })
  } catch (error) {
    console.error('Error updating score:', error)
    return NextResponse.json({ error: 'Failed to update score' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const roundId = searchParams.get('roundId')
    if (!roundId) {
      return NextResponse.json({ error: 'Round ID required' }, { status: 400 })
    }
    const result = await scoreService.getScoresForRound(roundId, session.user.id)
    if (!result.success) {
      const status = result.error === 'Round not found' ? 404
        : result.error === 'Access denied' ? 403 : 400
      return NextResponse.json({ error: result.error }, { status })
    }
    return NextResponse.json({ success: true, data: result.scores })
  } catch (error) {
    console.error('Error fetching scores:', error)
    return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 500 })
  }
}
