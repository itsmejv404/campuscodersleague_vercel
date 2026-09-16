import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
    }

    const teamId = params.id;
    const body = await req.json();
    const { name, memberIds, memberUpdates } = body;

    // Verify team exists
    const existingTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!existingTeam) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    const cleanName = name ? String(name).trim() : existingTeam.name;

    // If name changed, check uniqueness
    if (cleanName.toLowerCase() !== existingTeam.name.toLowerCase()) {
      const duplicate = await prisma.team.findFirst({
        where: {
          name: { equals: cleanName, mode: "insensitive" },
          id: { not: teamId },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: `The team name "${cleanName}" is already taken by another team.` },
          { status: 400 }
        );
      }
    }

    // Atomic update in Prisma transaction
    const updatedTeam = await prisma.$transaction(async (tx) => {
      // 1. Update Team Name
      const team = await tx.team.update({
        where: { id: teamId },
        data: { name: cleanName },
      });

      // 2. If memberIds provided, update assignments
      if (Array.isArray(memberIds)) {
        // Verify participants exist and are not in another team
        const participantsToAssign = await tx.participant.findMany({
          where: { id: { in: memberIds } },
        });

        const assignedToOther = participantsToAssign.filter(
          (p) => p.teamId !== null && p.teamId !== teamId
        );
        if (assignedToOther.length > 0) {
          const names = assignedToOther.map((p) => `"${p.name}" (${p.studentId})`).join(", ");
          throw new Error(`The following participant(s) are already part of another team: ${names}`);
        }

        // Unassign members that were removed from this team
        await tx.participant.updateMany({
          where: {
            teamId,
            id: { notIn: memberIds },
          },
          data: { teamId: null },
        });

        // Assign new members to this team
        await tx.participant.updateMany({
          where: {
            id: { in: memberIds },
          },
          data: { teamId },
        });
      }

      // 3. If memberUpdates provided (editing student name, phone, email, category)
      if (Array.isArray(memberUpdates)) {
        for (const update of memberUpdates) {
          if (update.id) {
            await tx.participant.update({
              where: { id: update.id },
              data: {
                name: update.name ? String(update.name).trim() : undefined,
                email: update.email ? String(update.email).toLowerCase().trim() : undefined,
                phone: update.phone ? String(update.phone).trim() : undefined,
                category: update.category === "CS" || update.category === "NonCS" ? update.category : undefined,
              },
            });
          }
        }
      }

      return team;
    });

    // Fetch updated team with fresh members
    const freshTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: true,
        _count: { select: { votes: true } },
      },
    });

    return NextResponse.json({
      success: true,
      team: freshTeam,
      message: "Team and member details updated successfully.",
    });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json(
        { error: "This team name is already taken. Please choose a unique team name." },
        { status: 400 }
      );
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in PUT /api/admin/teams/[id]:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
    }

    const teamId = params.id;

    const existingTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!existingTeam) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    // Atomic transaction: Unassign all participants, then delete team and its votes
    await prisma.$transaction(async (tx) => {
      // 1. Release all participants back to unassigned pool
      await tx.participant.updateMany({
        where: { teamId },
        data: { teamId: null },
      });

      // 2. Delete team (votes cascade deleted)
      await tx.team.delete({
        where: { id: teamId },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Team "${existingTeam.name}" has been disbanded. All ${existingTeam.members.length} members are now available to form or join another team.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in DELETE /api/admin/teams/[id]:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
