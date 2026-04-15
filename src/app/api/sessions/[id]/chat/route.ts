import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { chatService } from "@/services/chat.service";
import { z } from "zod";

// ============================================
// GET /api/sessions/[id]/chat - Get messages for a session
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const take = searchParams.get("take");
    const since = searchParams.get("since");

    // If 'since' is provided, get only new messages (for polling)
    if (since) {
      const sinceDate = new Date(since);
      const result = await chatService.getNewMessages(
        sessionId,
        session.user.id,
        sinceDate
      );

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, data: result.messages });
    }

    // Otherwise, get all messages
    const result = await chatService.getMessages(sessionId, session.user.id, {
      take: take ? parseInt(take, 10) : 100,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.messages });
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/sessions/[id]/chat - Send a message
// ============================================

const sendMessageSchema = z.object({
  text: z.string().min(1).max(1000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = sendMessageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors },
        { status: 400 }
      );
    }

    const result = await chatService.sendMessage({
      sessionId,
      userId: session.user.id,
      userName: session.user.name || session.user.username || "Player",
      text: validation.data.text,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.message });
  } catch (error) {
    console.error("Error sending chat message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/sessions/[id]/chat - Clear chat (host only)
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await chatService.clearMessages(sessionId, session.user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing chat messages:", error);
    return NextResponse.json(
      { error: "Failed to clear messages" },
      { status: 500 }
    );
  }
}
