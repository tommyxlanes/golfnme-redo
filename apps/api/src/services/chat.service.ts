import { chatRepository, type ChatMessageWithUser } from "@/repositories";
import { sessionRepository } from "@/repositories";
import type { ChatMessage } from "@prisma/client";

export interface SendMessageInput {
  sessionId: string;
  userId: string;
  userName: string;
  text: string;
}

export interface ChatResult {
  success: boolean;
  message?: ChatMessage;
  error?: string;
}

export interface ChatMessagesResult {
  success: boolean;
  messages?: ChatMessage[];
  error?: string;
}

export class ChatService {
  /**
   * Send a chat message
   */
  async sendMessage(input: SendMessageInput): Promise<ChatResult> {
    // Validate text
    if (!input.text?.trim()) {
      return { success: false, error: "Message text is required" };
    }

    // Verify session exists and user is a member
    const session = await sessionRepository.findByIdWithDetails(
      input.sessionId
    );

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    // Check if user is host or member
    const isHost = session.hostId === input.userId;
    const isMember = session.members.some((m) => m.userId === input.userId);

    if (!isHost && !isMember) {
      return { success: false, error: "Not a member of this session" };
    }

    // Check session status - allow chat in WAITING and IN_PROGRESS
    if (session.status === "COMPLETED" || session.status === "CANCELLED") {
      return { success: false, error: "Session has ended" };
    }

    // Create message
    const message = await chatRepository.create({
      sessionId: input.sessionId,
      userId: input.userId,
      userName: input.userName,
      text: input.text.trim(),
    });

    return { success: true, message };
  }

  /**
   * Get messages for a session
   */
  async getMessages(
    sessionId: string,
    userId: string,
    options?: { take?: number }
  ): Promise<ChatMessagesResult> {
    // Verify session exists
    const session = await sessionRepository.findByIdWithDetails(sessionId);

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    // Check if user is host or member
    const isHost = session.hostId === userId;
    const isMember = session.members.some((m) => m.userId === userId);

    if (!isHost && !isMember) {
      return { success: false, error: "Not a member of this session" };
    }

    const messages = await chatRepository.findBySessionId(sessionId, {
      take: options?.take ?? 100,
    });

    return { success: true, messages };
  }

  /**
   * Get new messages since a timestamp (for polling fallback)
   */
  async getNewMessages(
    sessionId: string,
    userId: string,
    since: Date
  ): Promise<ChatMessagesResult> {
    // Verify session exists and user has access
    const session = await sessionRepository.findByIdWithDetails(sessionId);

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    const isHost = session.hostId === userId;
    const isMember = session.members.some((m) => m.userId === userId);

    if (!isHost && !isMember) {
      return { success: false, error: "Not a member of this session" };
    }

    const messages = await chatRepository.findNewMessages(sessionId, since);

    return { success: true, messages };
  }

  /**
   * Clear chat history for a session (host only)
   */
  async clearMessages(
    sessionId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const session = await sessionRepository.findById(sessionId);

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    if (session.hostId !== userId) {
      return { success: false, error: "Only the host can clear chat" };
    }

    await chatRepository.deleteBySessionId(sessionId);

    return { success: true };
  }
}

// Singleton instance
export const chatService = new ChatService();
