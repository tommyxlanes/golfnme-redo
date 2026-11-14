import bcrypt from 'bcryptjs'
import { userRepository, type CreateUserInput } from '@/repositories'

export interface RegisterInput {
  email: string
  name: string
  username: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface AuthResult {
  success: boolean
  user?: {
    id: string
    email: string
    name: string
    username: string
    avatarUrl: string | null
    handicap: number | null
  }
  error?: string
}

export class AuthService {
  private readonly SALT_ROUNDS = 12

  async register(input: RegisterInput): Promise<AuthResult> {
    // Check if email already exists
    if (await userRepository.emailExists(input.email)) {
      return { success: false, error: 'Email already registered' }
    }

    // Check if username already exists
    if (await userRepository.usernameExists(input.username)) {
      return { success: false, error: 'Username already taken' }
    }

    // Hash password
    const passwordHash = await this.hashPassword(input.password)

    // Create user
    const user = await userRepository.create({
      email: input.email,
      name: input.name,
      username: input.username,
      passwordHash,
    })

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

  async validateCredentials(input: LoginInput): Promise<AuthResult> {
    const user = await userRepository.findByEmail(input.email)

    if (!user || !user.passwordHash) {
      return { success: false, error: 'Invalid email or password' }
    }

    const isValid = await this.verifyPassword(input.password, user.passwordHash)

    if (!isValid) {
      return { success: false, error: 'Invalid email or password' }
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

  async findOrCreateOAuthUser(profile: {
    email: string
    name: string
    image?: string
  }): Promise<AuthResult> {
    let user = await userRepository.findByEmail(profile.email)

    if (user) {
      // Update avatar if changed
      if (profile.image && profile.image !== user.avatarUrl) {
        user = await userRepository.update(user.id, { avatarUrl: profile.image })
      }
    } else {
      // Create new user with generated username
      const username = await this.generateUniqueUsername(profile.email)

      user = await userRepository.create({
        email: profile.email,
        name: profile.name || 'Golfer',
        username,
        avatarUrl: profile.image,
      })
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

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS)
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  private async generateUniqueUsername(email: string): Promise<string> {
    const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_')
    let username = baseUsername
    let counter = 1

    while (await userRepository.usernameExists(username)) {
      username = `${baseUsername}${counter}`
      counter++
    }

    return username
  }
}

// Singleton instance
export const authService = new AuthService()
