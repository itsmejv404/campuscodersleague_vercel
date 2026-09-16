import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Please sign in to vote." }, { status: 401 });
    }

    const { teamId } = await req.json();

    if (!teamId || typeof teamId !== "string") {
      return NextResponse.json({ error: "teamId is required." }, { status: 400 });
    }

    // Check Voting Window
    const now = new Date();
    const activeWindow = await prisma.votingWindow.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (!activeWindow) {
      return NextResponse.json(
        { error: "Voting is currently not open. Please check back later." },
        { status: 403 }
      );
    }

    if (now < activeWindow.startsAt) {
      return NextResponse.json(
        {
          error: `Voting has not started yet. Opens on ${activeWindow.startsAt.toLocaleString()}.`,
        },
        { status: 403 }
      );
    }

    if (now > activeWindow.endsAt) {
      return NextResponse.json(
        {
          error: `Voting has concluded on ${activeWindow.endsAt.toLocaleString()}.`,
        },
        { status: 403 }
      );
    }

    // Verify team exists
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    // Insert vote (enforcing uniqueness per user per team)
    try {
      await prisma.vote.create({
        data: {
          teamId,
          voterUserId: session.user.id,
        },
      });
    } catch (err: unknown) {
      // Check Prisma unique constraint violation P2002
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
        return NextResponse.json(
          { error: `You have already cast a vote for "${team.name}".` },
          { status: 400 }
        );
      }
      throw err;
    }

    // Get updated total vote count for this team
    const voteCount = await prisma.vote.count({
      where: { teamId },
    });

    return NextResponse.json({
      success: true,
      teamId,
      voteCount,
      message: `Vote successfully recorded for team "${team.name}"!`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in POST /api/votes:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
