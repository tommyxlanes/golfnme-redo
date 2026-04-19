import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateHoleSchema = z.object({
  holeNumber: z.number().int().min(1).max(18),
  par: z.number().int().min(3).max(6),
  yardage: z.number().int().optional().nullable(),
  handicapRank: z.number().int().min(1).max(18).optional().nullable(),
});

// ── PATCH /api/courses/[id]/holes ─────────────────────────────────────────
// Update a single hole's par/yardage on a course.
// Persists for ALL users — community shared.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId } = await params;
  const body = await req.json();
  const validation = updateHoleSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.errors },
      { status: 400 },
    );
  }

  const { holeNumber, par, yardage } = validation.data;

  // Find the hole
  const hole = await prisma.hole.findFirst({
    where: { courseId, holeNumber },
  });

  if (!hole) {
    return NextResponse.json({ error: "Hole not found" }, { status: 404 });
  }

  const updated = await prisma.hole.update({
    where: { id: hole.id },
    data: {
      par,
      ...(yardage !== undefined ? { yardage } : {}),
      ...(validation.data.handicapRank !== undefined
        ? { handicapRank: validation.data.handicapRank }
        : {}),
    },
  });

  // Recompute and update course total par
  const allHoles = await prisma.hole.findMany({ where: { courseId } });
  const totalPar = allHoles.reduce((sum, h) => sum + h.par, 0);
  await prisma.course.update({
    where: { id: courseId },
    data: { par: totalPar },
  });

  return NextResponse.json({ success: true, hole: updated, totalPar });
}

// ── PUT /api/courses/[id]/holes ───────────────────────────────────────────
// Bulk-upsert all holes for a course (used when creating with full scorecard)
const bulkHoleSchema = z.object({
  holes: z.array(
    z.object({
      holeNumber: z.number().int().min(1).max(18),
      par: z.number().int().min(3).max(6),
      yardage: z.number().int().optional().nullable(),
      handicapRank: z.number().int().optional().nullable(),
    }),
  ),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId } = await params;
  const body = await req.json();
  const validation = bulkHoleSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.errors },
      { status: 400 },
    );
  }

  // Upsert each hole
  const results = await Promise.all(
    validation.data.holes.map((h) =>
      prisma.hole.upsert({
        where: { courseId_holeNumber: { courseId, holeNumber: h.holeNumber } },
        update: {
          par: h.par,
          yardage: h.yardage ?? null,
          handicapRank: h.handicapRank ?? null,
        },
        create: {
          courseId,
          holeNumber: h.holeNumber,
          par: h.par,
          yardage: h.yardage ?? null,
          handicapRank: h.handicapRank ?? null,
        },
      }),
    ),
  );

  // Update total par
  const totalPar = results.reduce((sum, h) => sum + h.par, 0);
  await prisma.course.update({
    where: { id: courseId },
    data: { par: totalPar },
  });

  return NextResponse.json({ success: true, holes: results, totalPar });
}
