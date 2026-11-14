import { isValidId } from "@/lib/isValidCuid";
import {
  friendRepository,
  userRepository,
  type FriendRequestWithUser,
  type FriendshipWithUsers,
} from "@/repositories";
import type { User } from "@prisma/client";

export interface FriendInfo {
  id: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  handicap: number | null;
  friendshipId: string;
  since: Date;
}

export interface FriendsResult {
  success: boolean;
  friends?: FriendInfo[];
  error?: string;
}

export interface RequestsResult {
  success: boolean;
  requests?: FriendRequestWithUser[];
  error?: string;
}

export interface FriendActionResult {
  success: boolean;
  error?: string;
  receiverId?: string;
  senderId?: string;
}

export class FriendService {
  /**
   * Get all friends for a user
   */
  async getFriends(userId: string): Promise<FriendsResult> {
    const friendships = await friendRepository.findFriendships(userId);

    const friends: FriendInfo[] = friendships.map((f) => {
      const friend = f.user1Id === userId ? f.user2 : f.user1;
      return {
        id: friend.id,
        name: friend.name,
        username: friend.username,
        avatarUrl: friend.avatarUrl,
        handicap: friend.handicap,
        friendshipId: f.id,
        since: f.createdAt,
      };
    });

    return { success: true, friends };
  }

  /**
   * Get pending friend requests received by user
   */
  async getPendingRequests(userId: string): Promise<RequestsResult> {
    const requests = await friendRepository.findPendingRequestsReceived(userId);
    return { success: true, requests };
  }

  /**
   * Get pending friend requests sent by user
   */
  async getSentRequests(userId: string): Promise<RequestsResult> {
    const requests = await friendRepository.findPendingRequestsSent(userId);
    return { success: true, requests };
  }

  /**
   * Send a friend request
   */
  async sendRequest(
    senderId: string,
    receiverIdentifier: string,
  ): Promise<FriendActionResult> {
    let receiver = null;

    // Only treat identifier as ObjectId if it's valid
    if (isValidId(receiverIdentifier)) {
      receiver = await userRepository.findById(receiverIdentifier);
    }

    // Otherwise, search by username
    if (!receiver) {
      receiver = await userRepository.findByUsername(receiverIdentifier);
    }

    if (!receiver) {
      return { success: false, error: "User not found" };
    }

    if (receiver.id === senderId) {
      return {
        success: false,
        error: "Cannot send friend request to yourself",
      };
    }

    const areFriends = await friendRepository.areFriends(senderId, receiver.id);
    if (areFriends) {
      return { success: false, error: "Already friends" };
    }

    const existingRequest = await friendRepository.findExistingRequest(
      senderId,
      receiver.id,
    );
    if (existingRequest?.status === "PENDING") {
      if (existingRequest.senderId === receiver.id) {
        return this.acceptRequest(existingRequest.id, senderId);
      }
      return { success: false, error: "Friend request already sent" };
    }

    // If old declined/cancelled request exists, reset to PENDING
    // instead of inserting a duplicate (avoids unique constraint error)
    if (existingRequest) {
      await friendRepository.updateRequestStatus(existingRequest.id, "PENDING");
    } else {
      await friendRepository.createRequest(senderId, receiver.id);
    }

    return { success: true, receiverId: receiver.id };
  }

  /**
   * Accept a friend request
   */
  async acceptRequest(
    requestId: string,
    userId: string,
  ): Promise<FriendActionResult> {
    const request = await friendRepository.findRequestById(requestId);

    if (!request) {
      return { success: false, error: "Request not found" };
    }

    if (request.receiverId !== userId) {
      return { success: false, error: "Not your request to accept" };
    }

    if (request.status !== "PENDING") {
      return { success: false, error: "Request is not pending" };
    }

    await friendRepository.updateRequestStatus(requestId, "ACCEPTED");

    await friendRepository.createFriendship(
      request.senderId,
      request.receiverId,
    );

    return { success: true, senderId: request.senderId }; // ← only this one
  }

  /**
   * Decline a friend request
   */
  async declineRequest(
    requestId: string,
    userId: string,
  ): Promise<FriendActionResult> {
    const request = await friendRepository.findRequestById(requestId);

    if (!request) {
      return { success: false, error: "Request not found" };
    }

    if (request.receiverId !== userId) {
      return { success: false, error: "Not your request to decline" };
    }

    if (request.status !== "PENDING") {
      return { success: false, error: "Request is not pending" };
    }

    await friendRepository.updateRequestStatus(requestId, "DECLINED");

    return { success: true };
  }

  /**
   * Cancel a sent friend request
   */
  async cancelRequest(
    requestId: string,
    userId: string,
  ): Promise<FriendActionResult> {
    const request = await friendRepository.findRequestById(requestId);

    if (!request) {
      return { success: false, error: "Request not found" };
    }

    if (request.senderId !== userId) {
      return { success: false, error: "Not your request to cancel" };
    }

    if (request.status !== "PENDING") {
      return { success: false, error: "Request is not pending" };
    }

    await friendRepository.deleteRequest(requestId);

    return { success: true };
  }

  /**
   * Remove a friend
   */
  async removeFriend(
    userId: string,
    friendId: string,
  ): Promise<FriendActionResult> {
    const areFriends = await friendRepository.areFriends(userId, friendId);

    if (!areFriends) {
      return { success: false, error: "Not friends" };
    }

    await friendRepository.deleteFriendshipByUsers(userId, friendId);

    return { success: true };
  }

  /**
   * Search for users to add as friends
   */
  async searchUsers(
    query: string,
    currentUserId: string,
  ): Promise<{ success: boolean; users?: any[]; error?: string }> {
    const users = await userRepository.findMany({ search: query, take: 20 });

    // Filter out current user and add friendship status
    const results = await Promise.all(
      users
        .filter((u) => u.id !== currentUserId)
        .map(async (u) => {
          const areFriends = await friendRepository.areFriends(
            currentUserId,
            u.id,
          );
          const pendingRequest = await friendRepository.findExistingRequest(
            currentUserId,
            u.id,
          );

          return {
            id: u.id,
            name: u.name,
            username: u.username,
            avatarUrl: u.avatarUrl,
            handicap: u.handicap,
            isFriend: areFriends,
            hasPendingRequest: pendingRequest?.status === "PENDING",
            requestSentByMe: pendingRequest?.senderId === currentUserId,
          };
        }),
    );

    return { success: true, users: results };
  }

  /**
   * Get friend counts and request counts
   */
  async getCounts(userId: string): Promise<{
    friends: number;
    pendingRequests: number;
  }> {
    const [friends, pendingRequests] = await Promise.all([
      friendRepository.countFriends(userId),
      friendRepository.countPendingRequests(userId),
    ]);

    return { friends, pendingRequests };
  }
}

// Singleton instance
export const friendService = new FriendService();
