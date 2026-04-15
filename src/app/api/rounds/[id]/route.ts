import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { roundService } from '@/services'
import {
  dispatchStatsRecompute,
  dispatchHandicapRecompute,
  dispatchLeaderboardUpdate,
} from '@/lib/queue'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const result = await roundService.getRound(id, session.user.id)
    if (!result.success) {
      const status = result.error === 'Round not found' ? 404
        : result.error === 'Access denied' ? 403 : 400
      return NextResponse.json({ error: result.error }, { status })
    }
    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    console.error('Error fetching round:', error)
    return NextResponse.json({ error: 'Failed to fetch round' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const body = await request.json()
    let result

    if (body.status === 'COMPLETED') {
      result = await roundService.completeRound(id, session.user.id)
      if (result.success) {
        // Recompute stats + handicap for this user
        await Promise.all([
          dispatchStatsRecompute(session.user.id),
          dispatchHandicapRecompute(session.user.id),
        ])
        // Update session leaderboard if this is a group round
        if (result.round?.sessionId) {
          await dispatchLeaderboardUpdate(
            result.round.sessionId,
            session.user.id,
            result.round.scores?.length ?? 18
          )
        }
      }
    } else if (body.status === 'ABANDONED') {
      result = await roundService.abandonRound(id, session.user.id)
      if (result.success) {
        await dispatchStatsRecompute(session.user.id)
      }
    } else {
      result = await roundService.updateRound(id, session.user.id, {
        notes: body.notes,
        weather: body.weather,
      })
    }

    if (!result.success) {
      const status = result.error === 'Round not found' ? 404
        : result.error === 'Not your round' ? 403 : 400
      return NextResponse.json({ error: result.error }, { status })
    }
    return NextResponse.json({ success: true, data: result.round })
  } catch (error) {
    console.error('Error updating round:', error)
    return NextResponse.json({ error: 'Failed to update round' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const result = await roundService.deleteRound(id, session.user.id)
    if (!result.success) {
      const status = result.error === 'Round not found' ? 404
        : result.error === 'Not your round' ? 403 : 400
      return NextResponse.json({ error: result.error }, { status })
    }
    // Recompute stats after deletion
    await Promise.all([
      dispatchStatsRecompute(session.user.id),
      dispatchHandicapRecompute(session.user.id),
    ])
    return NextResponse.json({ success: true, message: 'Round deleted' })
  } catch (error) {
    console.error('Error deleting round:', error)
    return NextResponse.json({ error: 'Failed to delete round' }, { status: 500 })
  }
}
