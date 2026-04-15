import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { friendService } from "@/services";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") ?? "";

  if (!query || query.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const result = await friendService.searchUsers(query, session.user.id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ users: result.users });
}
