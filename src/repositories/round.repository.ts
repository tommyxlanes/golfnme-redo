import { prisma } from '@/lib/prisma'
import type { Round, RoundStatus, Course, Score, Hole, User, GroupSession } from '@prisma/client'
import type { PaginatedResult } from './base.repository'

export interface CreateRoundInput {
  userId: string
  courseId: string
  sessionId?: string
  weather?: string
  notes?: string
}

export interface UpdateRoundInput {
  status?: RoundStatus
  weather?: string
  notes?: string
  totalScore?: number
  totalPutts?: number
  fairwaysHit?: number
  greensInReg?: number
}

export interface RoundWithDetails extends Round {
  course: Course & { holes: Hole[] }
  scores: (Score & { hole: Hole })[]
  user: Pick<User, 'id' | 'name' | 'username' | 'avatarUrl' | 'handicap'>
  session?: GroupSession | null
}

export interface RoundWithCourse extends Round {
  course: Course
  scores: (Score & { hole: Hole })[]
}

export class RoundRepository {
  async findById(id: string): Promise<Round | null> {
    return prisma.round.findUnique({
      where: { id },
    })
  }

  async findByIdWithDetails(id: string): Promise<RoundWithDetails | null> {
    return prisma.round.findUnique({
      where: { id },
      include: {
        course: {
          include: {
            holes: {
              orderBy: { holeNumber: 'asc' },
            },
          },
        },
        scores: {
          include: { hole: true },
          orderBy: { hole: { holeNumber: 'asc' } },
        },
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            handicap: true,
          },
        },
        session: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    username: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    })
  }

  async findByUserId(
    userId: string,
    options?: {
      courseId?: string
      status?: RoundStatus
      take?: number
      skip?: number
    }
  ): Promise<PaginatedResult<RoundWithCourse>> {
    const where: any = { userId }

    if (options?.courseId) where.courseId = options.courseId
    if (options?.status) where.status = options.status

    const [items, total] = await Promise.all([
      prisma.round.findMany({
        where,
        include: {
          course: true,
          scores: {
            include: { hole: true },
          },
        },
        orderBy: { playedAt: 'desc' },
        take: options?.take ?? 20,
        skip: options?.skip ?? 0,
      }),
      prisma.round.count({ where }),
    ])

    const take = options?.take ?? 20
    const skip = options?.skip ?? 0

    return {
      items,
      total,
      page: Math.floor(skip / take) + 1,
      pageSize: take,
      hasMore: skip + take < total,
    }
  }

  async findCompletedByUserId(
    userId: string,
    options?: {
      courseId?: string
      since?: Date
      take?: number
    }
  ): Promise<RoundWithDetails[]> {
    const where: any = {
      userId,
      status: 'COMPLETED',
    }

    if (options?.courseId) where.courseId = options.courseId
    if (options?.since) where.playedAt = { gte: options.since }

    return prisma.round.findMany({
      where,
      include: {
        course: {
          include: { holes: true },
        },
        scores: {
          include: { hole: true },
        },
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            handicap: true,
          },
        },
        session: true,
      },
      orderBy: { playedAt: 'desc' },
      take: options?.take,
    })
  }

  async create(data: CreateRoundInput): Promise<RoundWithDetails> {
    return prisma.round.create({
      data: {
        ...data,
        status: 'IN_PROGRESS',
      },
      include: {
        course: {
          include: {
            holes: {
              orderBy: { holeNumber: 'asc' },
            },
          },
        },
        scores: {
          include: { hole: true },
        },
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            handicap: true,
          },
        },
        session: true,
      },
    })
  }

  async update(id: string, data: UpdateRoundInput): Promise<Round> {
    return prisma.round.update({
      where: { id },
      data,
    })
  }

  async updateWithDetails(id: string, data: UpdateRoundInput): Promise<RoundWithDetails> {
    return prisma.round.update({
      where: { id },
      data,
      include: {
        course: {
          include: { holes: { orderBy: { holeNumber: 'asc' } } },
        },
        scores: {
          include: { hole: true },
          orderBy: { hole: { holeNumber: 'asc' } },
        },
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            handicap: true,
          },
        },
        session: true,
      },
    })
  }

  async delete(id: string): Promise<void> {
    await prisma.round.delete({
      where: { id },
    })
  }

  async countByUserId(userId: string, status?: RoundStatus): Promise<number> {
    return prisma.round.count({
      where: {
        userId,
        ...(status ? { status } : {}),
      },
    })
  }

  async findInProgressByUserId(userId: string): Promise<Round | null> {
    return prisma.round.findFirst({
      where: {
        userId,
        status: 'IN_PROGRESS',
      },
      orderBy: { createdAt: 'desc' },
    })
  }
}

// Singleton instance
export const roundRepository = new RoundRepository()
