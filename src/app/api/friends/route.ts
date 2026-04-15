import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { friendService } from "@/services";
import { z } from "zod";

// ============================================
// GET /api/friends
// ============================================

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    // 🔹 Pending incoming friend requests
    if (type === "requests") {
      const result = await friendService.getPendingRequests(userId);
      return NextResponse.json(result.requests); // <-- return array only
    }

    // 🔹 Pending outgoing friend requests
    if (type === "pending") {
      const result = await friendService.getSentRequests(userId);
      return NextResponse.json(result.requests); // <-- return array only
    }

    // 🔹 Default: list all friends
    const result = await friendService.getFriends(userId);
    return NextResponse.json(result.friends); // <-- return array only
  } catch (error) {
    console.error("Error fetching friends:", error);
    return NextResponse.json(
      { error: "Failed to fetch friends" },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/friends - Send request
// ============================================

const sendRequestSchema = z.object({
  username: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = sendRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors },
        { status: 400 }
      );
    }

    const result = await friendService.sendRequest(
      session.user.id,
      validation.data.username
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Friend request sent" });
  } catch (error) {
    console.error("Error sending friend request:", error);
    return NextResponse.json(
      { error: "Failed to send friend request" },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH /api/friends - Accept / Decline / Cancel
// ============================================

const updateRequestSchema = z.object({
  requestId: z.string(),
  action: z.enum(["accept", "decline", "cancel"]),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = updateRequestSchema.safeParse(body);

    console.log("PATCH BODY RAW:", body);
    console.log("VALIDATION:", validation);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors },
        { status: 400 }
      );
    }

    const { requestId, action } = validation.data;

    let result;
    if (action === "accept") {
      result = await friendService.acceptRequest(requestId, session.user.id);
    } else if (action === "decline") {
      result = await friendService.declineRequest(requestId, session.user.id);
    } else {
      result = await friendService.cancelRequest(requestId, session.user.id);
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating friend request:", error);
    return NextResponse.json(
      { error: "Failed to update friend request" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/friends - Remove friend
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const friendId = searchParams.get("friendId");

    if (!friendId) {
      return NextResponse.json(
        { error: "Friend ID required" },
        { status: 400 }
      );
    }

    const result = await friendService.removeFriend(session.user.id, friendId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Friend removed" });
  } catch (error) {
    console.error("Error removing friend:", error);
    return NextResponse.json(
      { error: "Failed to remove friend" },
      { status: 500 }
    );
  }
}
