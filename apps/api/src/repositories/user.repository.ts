import { prisma } from '@/lib/prisma'
import type { User } from '@prisma/client'

export interface CreateUserInput {
  email: string
  name: string
  username: string
  passwordHash?: string
  avatarUrl?: string
  handicap?: number
}

export interface UpdateUserInput {
  name?: string
  username?: string
  avatarUrl?: string
  handicap?: number
  homeCourseId?: string
}

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    })
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    })
  }

  async findByUsername(username: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { username },
    })
  }

  async findMany(options?: {
    search?: string
    take?: number
    skip?: number
  }): Promise<User[]> {
    const where: any = {}

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { username: { contains: options.search, mode: 'insensitive' } },
        { email: { contains: options.search, mode: 'insensitive' } },
      ]
    }

    return prisma.user.findMany({
      where,
      take: options?.take ?? 50,
      skip: options?.skip ?? 0,
      orderBy: { name: 'asc' },
    })
  }

  async create(data: CreateUserInput): Promise<User> {
    return prisma.user.create({
      data,
    })
  }

  async update(id: string, data: UpdateUserInput): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<void> {
    await prisma.user.delete({
      where: { id },
    })
  }

  async usernameExists(username: string, excludeId?: string): Promise<boolean> {
    const user = await prisma.user.findFirst({
      where: {
        username,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    })
    return !!user
  }

  async emailExists(email: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { email },
    })
    return !!user
  }
}

// Singleton instance
export const userRepository = new UserRepository()
