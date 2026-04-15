import {
  sessionRepository,
  courseRepository,
  type SessionWithDetails,
} from "@/repositories";
import { generateInviteCode } from "@/lib/golf-utils";
import { prisma } from "@/lib/prisma";

export interface CreateSessionInput {
  hostId: string;
  courseId: string;
  name?: string;
  maxPlayers?: number;
}

export interface SessionResult {
  success: boolean;
  session?: SessionWithDetails;
  error?: string;
}

export interface SessionsResult {
  success: boolean;
  sessions?: SessionWithDetails[];
  error?: string;
}

export class SessionService {
  /**
   * Create a new group session
   */
  async createSession(input: CreateSessionInput): Promise<SessionResult> {
    // Verify course exists
    const course = await courseRepository.findById(input.courseId);
    if (!course) {
      return { success: false, error: "Course not found" };
    }

    // Check if user already has an active session
    const activeSession = await sessionRepository.findActiveByUserId(
      input.hostId
    );
    if (activeSession) {
      return { success: false, error: "You already have an active session" };
    }

    // Generate unique invite code
    let inviteCode = generateInviteCode();
    while (await sessionRepository.inviteCodeExists(inviteCode)) {
      inviteCode = generateInviteCode();
    }

    // Create session
    const session = await sessionRepository.create({
      hostId: input.hostId,
      courseId: input.courseId,
      name: input.name,
      inviteCode,
      maxPlayers: input.maxPlayers ?? 4,
    });

    // Add host as a member
    await sessionRepository.addMember(session.id, input.hostId);

    // Refetch with updated members
    const updatedSession = await sessionRepository.findByIdWithDetails(
      session.id
    );

    return { success: true, session: updatedSession! };
  }

  /**
   * Get session by ID
   */
  async getSession(id: string, userId: string): Promise<SessionResult> {
    const session = await sessionRepository.findByIdWithDetails(id);

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    // Check if user is host or member
    const isHost = session.hostId === userId;
    const isMember = session.members.some((m) => m.userId === userId);

    if (!isHost && !isMember) {
      return { success: false, error: "Access denied" };
    }

    return { success: true, session };
  }

  /**
   * Get session by invite code (for joining)
   */
  async getSessionByInviteCode(inviteCode: string): Promise<SessionResult> {
    const session = await sessionRepository.findByInviteCode(inviteCode);

    if (!session) {
      return { success: false, error: "Invalid invite code" };
    }

    // if (session.status !== 'WAITING') {
    //   return { success: false, error: 'Session is not accepting new players' }
    // }
    // Allow WAITING (lobby) and IN_PROGRESS (playing)
    if (session.status === "COMPLETED" || session.status === "CANCELLED") {
      return { success: false, error: "Session has ended" };
    }

    return { success: true, session };
  }

  /**
   * Join a session
   */
  async joinSession(
    inviteCode: string,
    userId: string
  ): Promise<SessionResult> {
    const session = await sessionRepository.findByInviteCode(inviteCode);

    if (!session) {
      return { success: false, error: "Invalid invite code" };
    }

    if (session.status !== "WAITING") {
      return { success: false, error: "Session is not accepting new players" };
    }

    // Check if already a member
    const isMember = await sessionRepository.isMember(session.id, userId);
    if (isMember || session.hostId === userId) {
      return { success: false, error: "Already in this session" };
    }

    // Check max players
    const memberCount = await sessionRepository.getMemberCount(session.id);
    if (memberCount >= session.maxPlayers) {
      return { success: false, error: "Session is full" };
    }

    // Add member
    await sessionRepository.addMember(session.id, userId);

    const updatedSession = await sessionRepository.findByIdWithDetails(
      session.id
    );

    return { success: true, session: updatedSession! };
  }

  /**
   * Leave a session
   */
  async leaveSession(
    sessionId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const session = await sessionRepository.findByIdWithDetails(sessionId);

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    if (session.hostId === userId) {
      return {
        success: false,
        error: "Host cannot leave. Cancel the session instead.",
      };
    }

    const isMember = session.members.some((m) => m.userId === userId);
    if (!isMember) {
      return { success: false, error: "Not a member of this session" };
    }

    if (session.status === "IN_PROGRESS") {
      return { success: false, error: "Cannot leave a session in progress" };
    }

    await sessionRepository.removeMember(sessionId, userId);

    return { success: true };
  }

  /**
   * Set ready status
   */
  async setReady(
    sessionId: string,
    userId: string,
    isReady: boolean
  ): Promise<{ success: boolean; allReady?: boolean; error?: string }> {
    const session = await sessionRepository.findByIdWithDetails(sessionId);

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    const isMember = session.members.some((m) => m.userId === userId);
    if (!isMember && session.hostId !== userId) {
      return { success: false, error: "Not a member of this session" };
    }

    if (session.status !== "WAITING") {
      return { success: false, error: "Session is not in waiting state" };
    }

    await sessionRepository.setMemberReady(sessionId, userId, isReady);

    const allReady = await sessionRepository.getAllMembersReady(sessionId);

    return { success: true, allReady };
  }

  /**
   * Start a session (host only)
   */
  async startSession(
    sessionId: string,
    hostId: string
  ): Promise<SessionResult> {
    const session = await sessionRepository.findByIdWithDetails(sessionId);

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    if (session.hostId !== hostId) {
      return { success: false, error: "Only the host can start the session" };
    }

    if (session.status !== "WAITING") {
      return { success: false, error: "Session is not in waiting state" };
    }

    const allReady = await sessionRepository.getAllMembersReady(sessionId);
    if (!allReady) {
      return { success: false, error: "Not all members are ready" };
    }

    // Ensure course has holes
    const courseWithHoles = await prisma.course.findUnique({
      where: { id: session.courseId },
      include: { holes: true },
    });

    if (!courseWithHoles) {
      return { success: false, error: "Course not found" };
    }

    // Create default holes if course has none
    if (courseWithHoles.holes.length === 0) {
      const defaultPars = [
        4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5,
      ];
      await prisma.hole.createMany({
        data: defaultPars.map((par, i) => ({
          courseId: session.courseId,
          holeNumber: i + 1,
          par,
          yardage: par === 3 ? 165 : par === 4 ? 380 : 520,
          handicapRank: i + 1,
        })),
      });
    }

    // Create a round for each member
    const memberIds = session.members.map((m) => m.userId);
    await Promise.all(
      memberIds.map((userId) =>
        prisma.round.create({
          data: {
            userId,
            courseId: session.courseId,
            sessionId: session.id,
            status: "IN_PROGRESS",
          },
        })
      )
    );

    await sessionRepository.update(sessionId, {
      status: "IN_PROGRESS",
      startedAt: new Date(),
    });

    const updatedSession = await sessionRepository.findByIdWithDetails(
      sessionId
    );

    return { success: true, session: updatedSession! };
  }

  /**
   * End a session (host only)
   */
  async endSession(sessionId: string, hostId: string): Promise<SessionResult> {
    const session = await sessionRepository.findByIdWithDetails(sessionId);

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    if (session.hostId !== hostId) {
      return { success: false, error: "Only the host can end the session" };
    }

    await sessionRepository.update(sessionId, {
      status: "COMPLETED",
      endedAt: new Date(),
    });

    const updatedSession = await sessionRepository.findByIdWithDetails(
      sessionId
    );

    return { success: true, session: updatedSession! };
  }

  /**
   * Cancel a session (host only)
   */
  async cancelSession(
    sessionId: string,
    hostId: string
  ): Promise<{ success: boolean; error?: string }> {
    const session = await sessionRepository.findById(sessionId);

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    if (session.hostId !== hostId) {
      return { success: false, error: "Only the host can cancel the session" };
    }

    if (session.status === "COMPLETED") {
      return { success: false, error: "Cannot cancel a completed session" };
    }

    await sessionRepository.update(sessionId, { status: "CANCELLED" });

    return { success: true };
  }

  /**
   * Get user's sessions
   */
  async getUserSessions(
    userId: string,
    options?: { status?: "WAITING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" }
  ): Promise<SessionsResult> {
    const sessions = await sessionRepository.findByUserId(userId, options);
    return { success: true, sessions };
  }

  /**
   * Get user's active session if any
   */
  async getActiveSession(userId: string): Promise<SessionResult> {
    const session = await sessionRepository.findActiveByUserId(userId);

    if (!session) {
      return { success: false, error: "No active session" };
    }

    return { success: true, session };
  }

  async checkAndCompleteSession(sessionId: string): Promise<void> {
    const session = await sessionRepository.findByIdWithDetails(sessionId);

    if (!session || session.status !== "IN_PROGRESS") return;

    // Check if all rounds are completed
    const allRoundsCompleted = session.rounds?.every(
      (r) => r.status === "COMPLETED"
    );

    if (allRoundsCompleted) {
      await sessionRepository.update(sessionId, {
        status: "COMPLETED",
        endedAt: new Date(),
      });
    }
  }
}

// Singleton instance
export const sessionService = new SessionService();
