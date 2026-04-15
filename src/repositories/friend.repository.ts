import { prisma } from '@/lib/prisma'
import type { FriendRequest, Friendship, RequestStatus, User } from '@prisma/client'

export interface FriendRequestWithUser extends FriendRequest {
  sender: Pick<User, 'id' | 'name' | 'username' | 'avatarUrl' | 'handicap'>
  receiver: Pick<User, 'id' | 'name' | 'username' | 'avatarUrl' | 'handicap'>
}

export interface FriendshipWithUsers extends Friendship {
  user1: Pick<User, 'id' | 'name' | 'username' | 'avatarUrl' | 'handicap'>
  user2: Pick<User, 'id' | 'name' | 'username' | 'avatarUrl' | 'handicap'>
}

const userSelect = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
  handicap: true,
} as const

export class FriendRepository {
  // =====================
  // Friend Requests
  // =====================

  async findRequestById(id: string): Promise<FriendRequestWithUser | null> {
    return prisma.friendRequest.findUnique({
      where: { id },
      include: {
        sender: { select: userSelect },
        receiver: { select: userSelect },
      },
    })
  }

  async findPendingRequestsReceived(userId: string): Promise<FriendRequestWithUser[]> {
    return prisma.friendRequest.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING',
      },
      include: {
        sender: { select: userSelect },
        receiver: { select: userSelect },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findPendingRequestsSent(userId: string): Promise<FriendRequestWithUser[]> {
    return prisma.friendRequest.findMany({
      where: {
        senderId: userId,
        status: 'PENDING',
      },
      include: {
        sender: { select: userSelect },
        receiver: { select: userSelect },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findExistingRequest(
    senderId: string,
    receiverId: string
  ): Promise<FriendRequest | null> {
    return prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      },
    })
  }

  async createRequest(senderId: string, receiverId: string): Promise<FriendRequestWithUser> {
    return prisma.friendRequest.create({
      data: {
        senderId,
        receiverId,
        status: 'PENDING',
      },
      include: {
        sender: { select: userSelect },
        receiver: { select: userSelect },
      },
    })
  }

  async updateRequestStatus(
    id: string,
    status: RequestStatus
  ): Promise<FriendRequest> {
    return prisma.friendRequest.update({
      where: { id },
      data: { status },
    })
  }

  async deleteRequest(id: string): Promise<void> {
    await prisma.friendRequest.delete({
      where: { id },
    })
  }

  // =====================
  // Friendships
  // =====================

  async findFriendships(userId: string): Promise<FriendshipWithUsers[]> {
    return prisma.friendship.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        user1: { select: userSelect },
        user2: { select: userSelect },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findFriendship(user1Id: string, user2Id: string): Promise<Friendship | null> {
    // Ensure consistent ordering
    const [smallerId, largerId] = [user1Id, user2Id].sort()
    
    return prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: smallerId, user2Id: largerId },
          { user1Id: largerId, user2Id: smallerId },
        ],
      },
    })
  }

  async createFriendship(user1Id: string, user2Id: string): Promise<Friendship> {
    // Ensure consistent ordering for the unique constraint
    const [smallerId, largerId] = [user1Id, user2Id].sort()
    
    return prisma.friendship.create({
      data: {
        user1Id: smallerId,
        user2Id: largerId,
      },
    })
  }

  async deleteFriendship(id: string): Promise<void> {
    await prisma.friendship.delete({
      where: { id },
    })
  }

  async deleteFriendshipByUsers(user1Id: string, user2Id: string): Promise<void> {
    const friendship = await this.findFriendship(user1Id, user2Id)
    if (friendship) {
      await this.deleteFriendship(friendship.id)
    }
  }

  async areFriends(user1Id: string, user2Id: string): Promise<boolean> {
    const friendship = await this.findFriendship(user1Id, user2Id)
    return !!friendship
  }

  async countFriends(userId: string): Promise<number> {
    return prisma.friendship.count({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
    })
  }

  async countPendingRequests(userId: string): Promise<number> {
    return prisma.friendRequest.count({
      where: {
        receiverId: userId,
        status: 'PENDING',
      },
    })
  }
}

// Singleton instance
export const friendRepository = new FriendRepository()
