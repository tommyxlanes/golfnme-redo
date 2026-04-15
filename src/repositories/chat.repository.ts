import { prisma } from "@/lib/prisma";
import type { ChatMessage } from "@prisma/client";

export interface CreateChatMessageInput {
  sessionId: string;
  userId: string;
  userName: string;
  text: string;
}

export interface ChatMessageWithUser extends ChatMessage {
  user?: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
  };
}

export class ChatRepository {
  /**
   * Find messages by session ID
   */
  async findBySessionId(
    sessionId: string,
    options?: {
      take?: number;
      skip?: number;
      cursor?: string;
    }
  ): Promise<ChatMessage[]> {
    return prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: options?.take ?? 100,
      skip: options?.skip ?? 0,
      ...(options?.cursor
        ? {
            cursor: { id: options.cursor },
            skip: 1,
          }
        : {}),
    });
  }

  /**
   * Find messages with user details
   */
  async findBySessionIdWithUser(
    sessionId: string,
    options?: {
      take?: number;
    }
  ): Promise<ChatMessageWithUser[]> {
    return prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: options?.take ?? 100,
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
    });
  }

  /**
   * Create a new chat message
   */
  async create(data: CreateChatMessageInput): Promise<ChatMessage> {
    return prisma.chatMessage.create({
      data: {
        sessionId: data.sessionId,
        userId: data.userId,
        userName: data.userName,
        text: data.text,
      },
    });
  }

  /**
   * Delete all messages for a session
   */
  async deleteBySessionId(sessionId: string): Promise<void> {
    await prisma.chatMessage.deleteMany({
      where: { sessionId },
    });
  }

  /**
   * Get message count for a session
   */
  async getCountBySessionId(sessionId: string): Promise<number> {
    return prisma.chatMessage.count({
      where: { sessionId },
    });
  }

  /**
   * Find messages after a certain timestamp (for polling)
   */
  async findNewMessages(
    sessionId: string,
    afterTimestamp: Date
  ): Promise<ChatMessage[]> {
    return prisma.chatMessage.findMany({
      where: {
        sessionId,
        createdAt: { gt: afterTimestamp },
      },
      orderBy: { createdAt: "asc" },
    });
  }
}

// Singleton instance
export const chatRepository = new ChatRepository();
