import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { courseService } from '@/services'
import { z } from 'zod'

// ============================================
// GET /api/courses - List courses
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') ?? undefined
    const limit = parseInt(searchParams.get('limit') || '50')
    
    const result = await courseService.getCourses({ search, take: limit })
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      data: result.courses,
    })
  } catch (error) {
    console.error('Error fetching courses:', error)
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 })
  }
}

// ============================================
// POST /api/courses - Create a course
// ============================================

const createCourseSchema = z.object({
  name: z.string().min(2),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default('USA'),
  par: z.number().int().min(27).max(80).default(72),
  numHoles: z.number().int().min(9).max(18).default(18),
  rating: z.number().optional(),
  slope: z.number().int().optional(),
  holes: z.array(z.object({
    holeNumber: z.number().int().min(1).max(18),
    par: z.number().int().min(3).max(6),
    yardage: z.number().int().optional(),
    handicapRank: z.number().int().min(1).max(18).optional(),
  })).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const validation = createCourseSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors }, { status: 400 })
    }
    
    const result = await courseService.createCourse(validation.data)
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    
    return NextResponse.json({
      success: true,
      data: result.course,
    })
  } catch (error) {
    console.error('Error creating course:', error)
    return NextResponse.json({ error: 'Failed to create course' }, { status: 500 })
  }
}
