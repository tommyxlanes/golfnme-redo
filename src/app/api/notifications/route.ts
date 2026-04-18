import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── GET /api/notifications ────────────────────────────────────────────────
// Returns last 20 notifications for the current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ notifications });
}

// ── PATCH /api/notifications ──────────────────────────────────────────────
// Mark notifications as read
// Body: { ids?: string[] }  — if no ids, marks ALL as read
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const ids: string[] | undefined = body.ids;

  await prisma.notification.updateMany({
    where: {
      userId: session.user.id,
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    data: { read: true },
  });

  return NextResponse.json({ success: true });
}

// ── DELETE /api/notifications ─────────────────────────────────────────────
// Delete notifications
// Query: ?id=xxx  — deletes single; no query = clears all
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");

  await prisma.notification.deleteMany({
    where: {
      userId: session.user.id,
      ...(id ? { id } : {}),
    },
  });

  return NextResponse.json({ success: true });
}
