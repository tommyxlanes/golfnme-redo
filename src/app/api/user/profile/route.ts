import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { userService } from '@/services'
import { z } from 'zod'

// ============================================
// GET /api/user/profile - Get current user profile
// ============================================

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const result = await userService.getProfile(session.user.id)
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }
    
    return NextResponse.json({
      success: true,
      user: result.user,
    })
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

// ============================================
// PATCH /api/user/profile - Update profile
// ============================================

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  username: z.string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/)
    .optional(),
  handicap: z.number().min(0).max(54).optional().nullable(),
})

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const validation = updateProfileSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }
    
    const result = await userService.updateProfile(session.user.id, validation.data)
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    
    return NextResponse.json({
      success: true,
      user: result.user,
    })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
