import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { statsService } from '@/services'

// ============================================
// GET /api/stats - Get user statistics
// ============================================

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'overview' | 'courses' | 'trends' | 'headtohead'
    const courseId = searchParams.get('courseId') ?? undefined
    const opponentId = searchParams.get('opponentId')
    const period = searchParams.get('period') || '90'
    
    const periodDays = parseInt(period)
    
    // ==========================================
    // OVERVIEW STATS
    // ==========================================
    if (type === 'overview' || !type) {
      const data = await statsService.getOverviewStats(userId)
      return NextResponse.json({ success: true, data })
    }
    
    // ==========================================
    // COURSE STATS
    // ==========================================
    if (type === 'courses') {
      const data = await statsService.getCourseStats(userId, courseId)
      return NextResponse.json({ success: true, data })
    }
    
    // ==========================================
    // TRENDS
    // ==========================================
    if (type === 'trends') {
      const data = await statsService.getTrendStats(userId, periodDays)
      return NextResponse.json({ success: true, data })
    }
    
    // ==========================================
    // HEAD TO HEAD
    // ==========================================
    if (type === 'headtohead' && opponentId) {
      const data = await statsService.getHeadToHeadStats(userId, opponentId)
      
      if (!data) {
        return NextResponse.json({
          success: true,
          data: {
            opponentId,
            opponentName: 'Unknown',
            wins: 0,
            losses: 0,
            ties: 0,
            averageMargin: 0,
            lastMatchup: null,
            sharedRounds: [],
          },
        })
      }
      
      return NextResponse.json({ success: true, data })
    }
    
    return NextResponse.json({ error: 'Invalid stats type' }, { status: 400 })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
