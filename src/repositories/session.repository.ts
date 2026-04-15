import { prisma } from "@/lib/prisma";
import type {
  GroupSession,
  SessionMember,
  SessionStatus,
  Course,
  User,
  Round,
  Score,
  Hole,
} from "@prisma/client";

export interface CreateSessionInput {
  hostId: string;
  courseId: string;
  name?: string;
  inviteCode: string;
  maxPlayers?: number;
}

export interface UpdateSessionInput {
  status?: SessionStatus;
  name?: string;
  startedAt?: Date;
  endedAt?: Date;
}

const userSelect = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
} as const;

export interface SessionMemberWithUser extends SessionMember {
  user: Pick<User, "id" | "name" | "username" | "avatarUrl">;
}

export interface SessionWithDetails extends GroupSession {
  host: Pick<User, "id" | "name" | "username" | "avatarUrl">;
  course: Course & { holes?: Hole[] };
  members: SessionMemberWithUser[];
  rounds?: (Round & {
    scores: Score[];
    user: Pick<User, "id" | "name" | "username" | "avatarUrl">;
  })[];
}

export class SessionRepository {
  async findById(id: string): Promise<GroupSession | null> {
    return prisma.groupSession.findUnique({
      where: { id },
    });
  }

  async findByIdWithDetails(id: string): Promise<SessionWithDetails | null> {
    return prisma.groupSession.findUnique({
      where: { id },
      include: {
        host: { select: userSelect },
        course: {
          include: {
            holes: {
              orderBy: { holeNumber: "asc" },
            },
          },
        },
        members: {
          include: {
            user: { select: userSelect },
          },
        },
        rounds: {
          include: {
            scores: true,
            user: { select: userSelect },
          },
        },
      },
    });
  }

  async findByInviteCode(
    inviteCode: string
  ): Promise<SessionWithDetails | null> {
    return prisma.groupSession.findUnique({
      where: { inviteCode: inviteCode.toUpperCase() },
      include: {
        host: { select: userSelect },
        course: {
          include: {
            holes: {
              orderBy: { holeNumber: "asc" },
            },
          },
        },
        members: {
          include: {
            user: { select: userSelect },
          },
        },
        rounds: {
          include: {
            scores: true,
            user: { select: userSelect },
          },
        },
      },
    });
  }

  async findByUserId(
    userId: string,
    options?: {
      status?: SessionStatus;
      take?: number;
      skip?: number;
    }
  ): Promise<SessionWithDetails[]> {
    return prisma.groupSession.findMany({
      where: {
        OR: [{ hostId: userId }, { members: { some: { userId } } }],
        ...(options?.status ? { status: options.status } : {}),
      },
      include: {
        host: { select: userSelect },
        course: true,
        members: {
          include: {
            user: { select: userSelect },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: options?.take ?? 20,
      skip: options?.skip ?? 0,
    });
  }

  async findActiveByUserId(userId: string): Promise<SessionWithDetails | null> {
    return prisma.groupSession.findFirst({
      where: {
        OR: [{ hostId: userId }, { members: { some: { userId } } }],
        status: { in: ["WAITING", "IN_PROGRESS"] },
      },
      include: {
        host: { select: userSelect },
        course: true,
        members: {
          include: {
            user: { select: userSelect },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(data: CreateSessionInput): Promise<SessionWithDetails> {
    return prisma.groupSession.create({
      data: {
        ...data,
        status: "WAITING",
      },
      include: {
        host: { select: userSelect },
        course: true,
        members: {
          include: {
            user: { select: userSelect },
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateSessionInput): Promise<GroupSession> {
    return prisma.groupSession.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.groupSession.delete({
      where: { id },
    });
  }

  // =====================
  // Session Members
  // =====================

  async addMember(
    sessionId: string,
    userId: string
  ): Promise<SessionMemberWithUser> {
    return prisma.sessionMember.create({
      data: {
        sessionId,
        userId,
      },
      include: {
        user: { select: userSelect },
      },
    });
  }

  async removeMember(sessionId: string, userId: string): Promise<void> {
    await prisma.sessionMember.delete({
      where: {
        sessionId_userId: {
          sessionId,
          userId,
        },
      },
    });
  }

  async isMember(sessionId: string, userId: string): Promise<boolean> {
    const member = await prisma.sessionMember.findUnique({
      where: {
        sessionId_userId: {
          sessionId,
          userId,
        },
      },
    });
    return !!member;
  }

  async setMemberReady(
    sessionId: string,
    userId: string,
    isReady: boolean
  ): Promise<SessionMember> {
    return prisma.sessionMember.update({
      where: {
        sessionId_userId: {
          sessionId,
          userId,
        },
      },
      data: { isReady },
    });
  }

  async getMemberCount(sessionId: string): Promise<number> {
    return prisma.sessionMember.count({
      where: { sessionId },
    });
  }

  async getAllMembersReady(sessionId: string): Promise<boolean> {
    const notReadyCount = await prisma.sessionMember.count({
      where: {
        sessionId,
        isReady: false,
      },
    });
    return notReadyCount === 0;
  }

  async inviteCodeExists(inviteCode: string): Promise<boolean> {
    const session = await prisma.groupSession.findUnique({
      where: { inviteCode },
    });
    return !!session;
  }
}

// Singleton instance
export const sessionRepository = new SessionRepository();
