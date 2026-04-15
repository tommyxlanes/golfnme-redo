import { prisma } from '@/lib/prisma'
import type { Course, Hole } from '@prisma/client'

export interface CreateCourseInput {
  name: string
  city?: string
  state?: string
  country?: string
  address?: string
  latitude?: number
  longitude?: number
  par?: number
  numHoles?: number
  rating?: number
  slope?: number
  imageUrl?: string
  isPublic?: boolean
}

export interface CreateHoleInput {
  holeNumber: number
  par: number
  yardage?: number
  handicapRank?: number
}

export interface CourseWithHoles extends Course {
  holes: Hole[]
}

export interface CourseWithStats extends Course {
  holes: Hole[]
  _count: {
    rounds: number
  }
}

export class CourseRepository {
  async findById(id: string): Promise<Course | null> {
    return prisma.course.findUnique({
      where: { id },
    })
  }

  async findByIdWithHoles(id: string): Promise<CourseWithHoles | null> {
    return prisma.course.findUnique({
      where: { id },
      include: {
        holes: {
          orderBy: { holeNumber: 'asc' },
        },
      },
    })
  }

  async findMany(options?: {
    search?: string
    isPublic?: boolean
    take?: number
    skip?: number
  }): Promise<CourseWithStats[]> {
    const where: any = {}

    if (options?.isPublic !== undefined) {
      where.isPublic = options.isPublic
    }

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { city: { contains: options.search, mode: 'insensitive' } },
        { state: { contains: options.search, mode: 'insensitive' } },
      ]
    }

    return prisma.course.findMany({
      where,
      include: {
        holes: {
          orderBy: { holeNumber: 'asc' },
        },
        _count: {
          select: { rounds: true },
        },
      },
      orderBy: { name: 'asc' },
      take: options?.take ?? 50,
      skip: options?.skip ?? 0,
    })
  }

  async create(
    data: CreateCourseInput,
    holes?: CreateHoleInput[]
  ): Promise<CourseWithHoles> {
    return prisma.course.create({
      data: {
        ...data,
        holes: holes
          ? { create: holes }
          : {
              // Create default holes if not provided
              create: Array.from({ length: data.numHoles ?? 18 }, (_, i) => ({
                holeNumber: i + 1,
                par: 4,
              })),
            },
      },
      include: {
        holes: {
          orderBy: { holeNumber: 'asc' },
        },
      },
    })
  }

  async update(id: string, data: Partial<CreateCourseInput>): Promise<Course> {
    return prisma.course.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<void> {
    await prisma.course.delete({
      where: { id },
    })
  }

  async findHolesByCourseId(courseId: string): Promise<Hole[]> {
    return prisma.hole.findMany({
      where: { courseId },
      orderBy: { holeNumber: 'asc' },
    })
  }

  async count(where?: { isPublic?: boolean }): Promise<number> {
    return prisma.course.count({ where })
  }
}

// Singleton instance
export const courseRepository = new CourseRepository()
