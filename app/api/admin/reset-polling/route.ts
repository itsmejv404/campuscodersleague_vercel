import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const resetTeams = body.resetTeams === true;

    // Count existing votes before deleting
    const voteCount = await prisma.vote.count();

    // 1. Delete all votes to reset polling
    await prisma.vote.deleteMany({});

    // 2. Optionally reset teams as well if requested
    let teamsCount = 0;
    if (resetTeams) {
      teamsCount = await prisma.team.count();
      // Unassign all participants
      await prisma.participant.updateMany({
        data: { teamId: null },
      });
      // Delete all teams (cascades to submissions and votes)
      await prisma.team.deleteMany({});

      // Clean up uploaded PDFs from disk
      try {
        const uploadsDir = path.join(process.cwd(), "public", "uploads", "submissions");
        const fs = await import("fs/promises");
        const files = await fs.readdir(uploadsDir).catch(() => []);
        for (const file of files) {
          if (file.endsWith(".pdf")) {
            await fs.unlink(path.join(uploadsDir, file)).catch(() => {});
          }
        }
      } catch {
        // Non-critical file cleanup
      }
    }

    return NextResponse.json({
      success: true,
      deletedVotes: voteCount,
      resetTeams,
      deletedTeams: teamsCount,
      message: resetTeams
        ? `Polling and teams have been completely reset (${voteCount} votes and ${teamsCount} teams cleared).`
        : `Polling has been reset to 0 (${voteCount} votes cleared). Teams and participant rosters remain intact.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in POST /api/admin/reset-polling:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
