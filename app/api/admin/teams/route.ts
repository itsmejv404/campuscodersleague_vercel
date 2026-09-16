import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() || "";

    const whereClause: Record<string, unknown> = {};
    if (query) {
      whereClause.OR = [
        { name: { contains: query, mode: "insensitive" } },
        {
          members: {
            some: {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
                { studentId: { contains: query, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    const [teams, unassignedParticipants] = await Promise.all([
      prisma.team.findMany({
        where: whereClause,
        include: {
          members: {
            select: {
              id: true,
              studentId: true,
              name: true,
              email: true,
              phone: true,
              gender: true,
              year: true,
              category: true,
            },
            orderBy: [{ category: "asc" }, { name: "asc" }],
          },
          _count: {
            select: { votes: true },
          },
        },
        orderBy: [{ createdAt: "desc" }],
      }),
      prisma.participant.findMany({
        where: { teamId: null },
        select: {
          id: true,
          studentId: true,
          name: true,
          email: true,
          phone: true,
          gender: true,
          year: true,
          category: true,
        },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      }),
    ]);

    return NextResponse.json({
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        createdByParticipantId: t.createdByParticipantId,
        createdAt: t.createdAt,
        members: t.members,
        voteCount: t._count.votes,
      })),
      unassignedParticipants,
      totalTeams: teams.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in GET /api/admin/teams:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
    }

    const body = await req.json();
    const { name, memberIds } = body;

    const cleanName = typeof name === "string" ? name.trim() : "";
    if (!cleanName || cleanName.length < 2 || cleanName.length > 60) {
      return NextResponse.json(
        { error: "Team name must be between 2 and 60 characters." },
        { status: 400 }
      );
    }

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json(
        { error: "Please select at least 1 member to form a team." },
        { status: 400 }
      );
    }

    // Check for duplicate member IDs
    const uniqueIds = new Set(memberIds);
    if (uniqueIds.size !== memberIds.length) {
      return NextResponse.json(
        { error: "Duplicate members selected in the roster." },
        { status: 400 }
      );
    }

    // Check team name uniqueness (case-insensitive)
    const existingTeam = await prisma.team.findFirst({
      where: {
        name: {
          equals: cleanName,
          mode: "insensitive",
        },
      },
    });

    if (existingTeam) {
      return NextResponse.json(
        { error: `The team name "${cleanName}" is already taken. Please choose another.` },
        { status: 400 }
      );
    }

    // Verify all selected participants exist and are not already in a team
    const participants = await prisma.participant.findMany({
      where: { id: { in: memberIds } },
    });

    if (participants.length !== memberIds.length) {
      return NextResponse.json(
        { error: "One or more selected participants could not be found." },
        { status: 400 }
      );
    }

    const alreadyAssigned = participants.filter((p) => p.teamId !== null);
    if (alreadyAssigned.length > 0) {
      const names = alreadyAssigned.map((p) => `"${p.name}" (${p.studentId})`).join(", ");
      return NextResponse.json(
        { error: `The following participant(s) are already assigned to a team: ${names}.` },
        { status: 400 }
      );
    }

    const creatorId = session.user.participantId || participants[0].id || "ADMIN";

    // Atomic team creation and member assignment without any category or count restriction
    const newTeam = await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          name: cleanName,
          createdByParticipantId: creatorId,
        },
      });

      await tx.participant.updateMany({
        where: { id: { in: memberIds } },
        data: { teamId: team.id },
      });

      return team;
    });

    return NextResponse.json(
      {
        success: true,
        team: newTeam,
        message: `Team "${newTeam.name}" created successfully with ${memberIds.length} member(s)!`,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json(
        { error: "This team name is already taken. Please choose a unique team name." },
        { status: 400 }
      );
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in POST /api/admin/teams:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
