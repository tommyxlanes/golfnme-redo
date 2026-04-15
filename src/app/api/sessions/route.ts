import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { sessionService } from '@/services'
import { z } from 'zod'

// ============================================
// GET /api/sessions - List sessions or get by invite code
// ============================================

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as any
    const inviteCode = searchParams.get('inviteCode')
    
    // If invite code provided, return that specific session
    if (inviteCode) {
      const result = await sessionService.getSessionByInviteCode(inviteCode)
      
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 404 })
      }
      
      return NextResponse.json({ success: true, data: result.session })
    }
    
    // Get user's sessions
    const result = await sessionService.getUserSessions(userId, { status })
    
    return NextResponse.json({ success: true, data: result.sessions })
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }
}

// ============================================
// POST /api/sessions - Create or join session
// ============================================

const createSessionSchema = z.object({
  courseId: z.string(),
  name: z.string().optional(),
  maxPlayers: z.number().int().min(2).max(8).default(4),
})

const joinSessionSchema = z.object({
  inviteCode: z.string().min(6).max(6),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    
    // Check if joining or creating
    if (body.inviteCode) {
      const validation = joinSessionSchema.safeParse(body)
      
      if (!validation.success) {
        return NextResponse.json({ error: validation.error.errors }, { status: 400 })
      }
      
      const result = await sessionService.joinSession(
        validation.data.inviteCode,
        session.user.id
      )
      
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      
      return NextResponse.json({ success: true, data: result.session })
    }
    
    // Creating new session
    const validation = createSessionSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors }, { status: 400 })
    }
    
    const result = await sessionService.createSession({
      hostId: session.user.id,
      ...validation.data,
    })
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    
    return NextResponse.json({ success: true, data: result.session })
  } catch (error) {
    console.error('Error with session:', error)
    return NextResponse.json({ error: 'Failed to process session request' }, { status: 500 })
  }
}

// ============================================
// PATCH /api/sessions - Update session (start, end, ready, leave)
// ============================================

const updateSessionSchema = z.object({
  sessionId: z.string(),
  action: z.enum(['start', 'end', 'cancel', 'ready', 'unready', 'leave']),
})

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const validation = updateSessionSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors }, { status: 400 })
    }
    
    const { sessionId, action } = validation.data
    let result
    
    switch (action) {
      case 'start':
        result = await sessionService.startSession(sessionId, session.user.id)
        break
      case 'end':
        result = await sessionService.endSession(sessionId, session.user.id)
        break
      case 'cancel':
        result = await sessionService.cancelSession(sessionId, session.user.id)
        return NextResponse.json({ success: result.success, error: result.error })
      case 'ready':
        const readyResult = await sessionService.setReady(sessionId, session.user.id, true)
        return NextResponse.json({ success: readyResult.success, allReady: readyResult.allReady, error: readyResult.error })
      case 'unready':
        const unreadyResult = await sessionService.setReady(sessionId, session.user.id, false)
        return NextResponse.json({ success: unreadyResult.success, allReady: unreadyResult.allReady, error: unreadyResult.error })
      case 'leave':
        result = await sessionService.leaveSession(sessionId, session.user.id)
        return NextResponse.json({ success: result.success, error: result.error })
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    
    return NextResponse.json({ success: true, data: result.session })
  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
  }
}
