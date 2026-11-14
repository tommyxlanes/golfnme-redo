import { userRepository, type UpdateUserInput } from '@/repositories'
import type { User } from '@prisma/client'

export interface UpdateProfileInput {
  name?: string
  username?: string
  handicap?: number
}

export interface ProfileResult {
  success: boolean
  user?: Pick<User, 'id' | 'email' | 'name' | 'username' | 'avatarUrl' | 'handicap'>
  error?: string
}

export class UserService {
  async getProfile(userId: string): Promise<ProfileResult> {
    const user = await userRepository.findById(userId)

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarUrl,
        handicap: user.handicap,
      },
    }
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<ProfileResult> {
    // Check if user exists
    const existingUser = await userRepository.findById(userId)
    if (!existingUser) {
      return { success: false, error: 'User not found' }
    }

    // Check username uniqueness if changing
    if (input.username && input.username !== existingUser.username) {
      const usernameExists = await userRepository.usernameExists(input.username, userId)
      if (usernameExists) {
        return { success: false, error: 'Username already taken' }
      }
    }

    // Update user
    const user = await userRepository.update(userId, input)

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarUrl,
        handicap: user.handicap,
      },
    }
  }

  async searchUsers(query: string, excludeUserId?: string): Promise<User[]> {
    const users = await userRepository.findMany({ search: query, take: 20 })
    
    if (excludeUserId) {
      return users.filter(u => u.id !== excludeUserId)
    }
    
    return users
  }

  async getUserById(userId: string): Promise<User | null> {
    return userRepository.findById(userId)
  }
}

// Singleton instance
export const userService = new UserService()
