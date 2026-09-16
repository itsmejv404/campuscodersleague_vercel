import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createTeamSchema = z.object({
  name: z
    .string()
    .min(2, "Team name must be at least 2 characters.")
    .max(60, "Team name must not exceed 60 characters.")
    .trim(),
  memberIds: z
    .array(z.string().min(1))
    .min(3, "A team must have at least 3 members.")
    .max(4, "A team cannot exceed 4 members."),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const [teams, availableCS, availableCore] = await Promise.all([
      prisma.team.findMany({
        include: {
          members: {
            select: {
              id: true,
              studentId: true,
              name: true,
              email: true,
              category: true,
              phone: true,
              year: true,
            },
          },
          submission: {
            select: {
              id: true,
              pdfUrl: true,
              fileName: true,
              fileSize: true,
              submitterName: true,
              submitterEmail: true,
              submitterStudentId: true,
              submittedAt: true,
              submissionCount: true,
            },
          },
          _count: {
            select: { votes: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.participant.count({ where: { teamId: null, category: "CS" } }),
      prisma.participant.count({ where: { teamId: null, category: "NonCS" } }),
    ]);

    const totalAvailable = availableCS + availableCore;
    // Last Teams Advantage: active if remaining CS < 3, or remaining Core < 1, or total pool <= 20
    const isLastTeamsAdvantage = availableCS < 3 || availableCore < 1 || totalAvailable <= 20;

    let votedTeamIds: string[] = [];
    if (session?.user?.id) {
      const userVotes = await prisma.vote.findMany({
        where: { voterUserId: session.user.id },
        select: { teamId: true },
      });
      votedTeamIds = userVotes.map((v) => v.teamId);
    }

    return NextResponse.json({
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        createdByParticipantId: t.createdByParticipantId,
        createdAt: t.createdAt,
        members: t.members,
        submission: t.submission,
        voteCount: t._count.votes,
      })),
      votedTeamIds,
      availableCS,
      availableCore,
      totalAvailable,
      isLastTeamsAdvantage,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in GET /api/teams:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const isAdmin = session.user.role === "ADMIN";

    if (!isAdmin && (session.user.role !== "PARTICIPANT" || !session.user.participantId)) {
      return NextResponse.json(
        { error: "Only registered participants are eligible to create a team." },
        { status: 403 }
      );
    }

    // If not admin, check if current participant is already in a team
    if (!isAdmin && session.user.participantId) {
      const currentParticipant = await prisma.participant.findUnique({
        where: { id: session.user.participantId },
        select: { teamId: true, name: true },
      });

      if (!currentParticipant) {
        return NextResponse.json(
          { error: "Participant profile not found." },
          { status: 404 }
        );
      }

      if (currentParticipant.teamId) {
        return NextResponse.json(
          { error: "You are already a member of an existing team." },
          { status: 400 }
        );
      }
    }

    const json = await req.json();
    const { name, memberIds } = json;

    const cleanName = typeof name === "string" ? name.trim() : "";
    if (!cleanName || cleanName.length < 2 || cleanName.length > 60) {
      return NextResponse.json(
        { error: "Team name must be between 2 and 60 characters." },
        { status: 400 }
      );
    }

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json(
        { error: "Please select at least 1 member for the team." },
        { status: 400 }
      );
    }

    // Check for duplicate member IDs in request
    const uniqueMembers = new Set(memberIds);
    if (uniqueMembers.size !== memberIds.length) {
      return NextResponse.json(
        { error: "Duplicate members selected. A team must consist of distinct individuals." },
        { status: 400 }
      );
    }

    // Requester must be one of the members of the team they are creating ONLY if not admin
    if (!isAdmin && session.user.participantId && !memberIds.includes(session.user.participantId)) {
      return NextResponse.json(
        { error: "You must include yourself as one of the team members." },
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

    // Check remaining unassigned pool to determine if Last Teams Advantage applies (for non-admin participants)
    const [availableCS, availableCore] = await Promise.all([
      prisma.participant.count({ where: { teamId: null, category: "CS" } }),
      prisma.participant.count({ where: { teamId: null, category: "NonCS" } }),
    ]);

    const totalAvailable = availableCS + availableCore;
    const isLastTeamsAdvantage = availableCS < 3 || availableCore < 1 || totalAvailable <= 20;

    // Atomic transaction: Verify participants, verify composition rules, create team, update teamId
    const newTeam = await prisma.$transaction(async (tx) => {
      // Re-fetch participants inside transaction for concurrency safety
      const participants = await tx.participant.findMany({
        where: { id: { in: memberIds } },
      });

      if (participants.length !== memberIds.length) {
        throw new Error("One or more selected participants could not be found.");
      }

      // Check if any participant is already in a team
      for (const p of participants) {
        if (p.teamId !== null) {
          throw new Error(`Participant "${p.name}" (${p.studentId}) is already part of another team.`);
        }
      }

      const csCount = participants.filter((p) => p.category === "CS").length;
      const coreCount = participants.filter((p) => p.category === "NonCS").length;

      // Composition Validation:
      if (!isAdmin) {
        if (!isLastTeamsAdvantage) {
          // Standard Rule: Exactly 4 members (3 CS + 1 Core)
          if (memberIds.length !== 4) {
            throw new Error("A standard team must have exactly 4 members.");
          }
          if (csCount !== 3 || coreCount !== 1) {
            throw new Error(
              `Standard team composition rule: Exactly 3 CS and 1 Core student required. Current: ${csCount} CS, ${coreCount} Core.`
            );
          }
        } else {
          // Last Teams Advantage: Flexible team size (3 or 4 members), any available composition
          if (memberIds.length < 3 || memberIds.length > 4) {
            throw new Error("A team under Last Teams Advantage must have 3 or 4 members.");
          }
        }
      }
      // Admins have no restriction on count (min 1) or category composition!

      const creatorId = (session.user.participantId) || participants[0]?.id || "ADMIN";

      // Create the Team
      const team = await tx.team.create({
        data: {
          name: cleanName,
          createdByParticipantId: creatorId,
        },
      });

      // Update all participants' teamId atomically
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
        isLastTeamsAdvantage,
        message: isAdmin
          ? `Team "${newTeam.name}" created successfully as Admin with ${memberIds.length} member(s)!`
          : isLastTeamsAdvantage
          ? `Team "${newTeam.name}" created successfully under Last Teams Advantage rules!`
          : "Team created successfully!",
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
    console.error("Error in POST /api/teams:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
