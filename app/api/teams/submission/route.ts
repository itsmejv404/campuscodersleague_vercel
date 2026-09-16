import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let teamId = searchParams.get("teamId");

    if (!teamId && (session.user.role === "PARTICIPANT" || session.user.participantId || session.user.email)) {
      const participant = await prisma.participant.findFirst({
        where: {
          OR: [
            ...(session.user.participantId ? [{ id: session.user.participantId }] : []),
            ...(session.user.email ? [{ email: session.user.email.toLowerCase().trim() }] : []),
          ],
        },
        select: { teamId: true },
      });
      teamId = participant?.teamId || null;
    }

    // Check submission window
    let windowRecord = await prisma.submissionWindow.findFirst({
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    let isWindowOpen = true;
    let windowStatus = "open";

    if (windowRecord) {
      if (!windowRecord.isOpen || !windowRecord.isActive) {
        isWindowOpen = false;
        windowStatus = "closed";
      } else if (windowRecord.startsAt && now < windowRecord.startsAt) {
        isWindowOpen = false;
        windowStatus = "upcoming";
      } else if (windowRecord.endsAt && now > windowRecord.endsAt) {
        isWindowOpen = false;
        windowStatus = "closed";
      }
    }

    if (!teamId) {
      return NextResponse.json({
        team: null,
        submission: null,
        isWindowOpen,
        windowStatus,
      });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          select: {
            id: true,
            studentId: true,
            name: true,
            email: true,
            category: true,
            phone: true,
          },
        },
        submission: true,
      },
    });

    return NextResponse.json({
      team,
      submission: team?.submission || null,
      isWindowOpen,
      windowStatus,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in GET /api/teams/submission:", err);
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
    const isParticipant = session.user.role === "PARTICIPANT";

    if (!isAdmin && !isParticipant) {
      return NextResponse.json(
        { error: "Only registered team participants or admins can submit proof of work." },
        { status: 403 }
      );
    }

    // Check submission window status (Admins can override if needed, but standard flow follows window)
    const windowRecord = await prisma.submissionWindow.findFirst({
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    let isClosed = false;

    if (windowRecord) {
      if (!windowRecord.isOpen || !windowRecord.isActive) {
        isClosed = true;
      } else if (windowRecord.startsAt && now < windowRecord.startsAt) {
        isClosed = true;
      } else if (windowRecord.endsAt && now > windowRecord.endsAt) {
        isClosed = true;
      }
    }

    if (isClosed && !isAdmin) {
      return NextResponse.json(
        { error: "Submissions are currently closed. New uploads and revisions cannot be accepted." },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    let targetTeamId = formData.get("teamId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No PDF file was provided." }, { status: 400 });
    }

    // Determine submitter metadata
    let submitterName = session.user.name || "Anonymous";
    let submitterEmail = session.user.email || "unknown@kiot.ac.in";
    let submitterStudentId = session.user.studentId || null;
    let participantId = session.user.participantId || null;

    if (isParticipant) {
      const userEmail = session.user.email?.toLowerCase().trim();
      const participant = await prisma.participant.findFirst({
        where: {
          OR: [
            ...(participantId ? [{ id: participantId }] : []),
            ...(userEmail ? [{ email: userEmail }] : []),
          ],
        },
        select: { id: true, name: true, email: true, studentId: true, teamId: true },
      });

      if (!participant) {
        return NextResponse.json(
          { error: "Participant account details could not be found." },
          { status: 400 }
        );
      }

      if (!participant.teamId) {
        return NextResponse.json(
          { error: "You must be a registered member of a team to submit proof of work." },
          { status: 400 }
        );
      }

      participantId = participant.id;
      targetTeamId = participant.teamId;
      submitterName = participant.name;
      submitterEmail = participant.email;
      submitterStudentId = participant.studentId;
    } else if (isAdmin) {
      if (!targetTeamId) {
        return NextResponse.json({ error: "Team ID is required for admin submission." }, { status: 400 });
      }
      submitterName = `Admin (${session.user.name || session.user.email})`;
      submitterEmail = session.user.email || "admin";
    }

    if (!targetTeamId) {
      return NextResponse.json({ error: "Target team not specified." }, { status: 400 });
    }

    // Verify team exists
    const team = await prisma.team.findUnique({
      where: { id: targetTeamId },
      include: { submission: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    // Validate File: Must be PDF
    const originalFileName = file.name || "proof_of_work.pdf";
    const extension = path.extname(originalFileName).toLowerCase();
    const mimeType = file.type;

    if (extension !== ".pdf" && mimeType !== "application/pdf") {
      return NextResponse.json(
        { error: "Invalid file format. Only PDF files (.pdf) are accepted as Proof of Work." },
        { status: 400 }
      );
    }

    // Max 15MB limit
    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds the 15MB limit. Please compress your PDF and try again." },
        { status: 400 }
      );
    }

    // Save PDF to public/uploads/submissions
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), "public", "uploads", "submissions");
    await fs.mkdir(uploadsDir, { recursive: true });

    // Generate a cryptographically secure random filename to prevent unauthorized guessing or enumeration
    const randomHex = crypto.randomBytes(24).toString("hex");
    const uniqueFileName = `${crypto.randomUUID()}_${randomHex}.pdf`;
    const filePath = path.join(uploadsDir, uniqueFileName);

    await fs.writeFile(filePath, buffer);
    const pdfUrl = `/uploads/submissions/${uniqueFileName}`;

    // Upsert Submission in DB
    const existingSubmission = team.submission;
    const nextCount = (existingSubmission?.submissionCount || 0) + 1;

    // If there was an old file, optionally clean it up if in the same folder
    if (existingSubmission?.pdfUrl?.startsWith("/uploads/submissions/")) {
      try {
        const oldFile = path.join(process.cwd(), "public", existingSubmission.pdfUrl);
        await fs.unlink(oldFile).catch(() => {});
      } catch {
        // Non-critical cleanup
      }
    }

    const updatedSubmission = await prisma.submission.upsert({
      where: { teamId: targetTeamId },
      update: {
        pdfUrl,
        fileName: originalFileName,
        fileSize: file.size,
        submittedByUserId: session.user.id || null,
        submittedByParticipantId: participantId,
        submitterName,
        submitterEmail,
        submitterStudentId,
        submittedAt: new Date(),
        submissionCount: nextCount,
      },
      create: {
        teamId: targetTeamId,
        pdfUrl,
        fileName: originalFileName,
        fileSize: file.size,
        submittedByUserId: session.user.id || null,
        submittedByParticipantId: participantId,
        submitterName,
        submitterEmail,
        submitterStudentId,
        submittedAt: new Date(),
        submissionCount: 1,
      },
    });

    return NextResponse.json({
      success: true,
      submission: updatedSubmission,
      message: `Proof of Work PDF uploaded successfully (Submission #${updatedSubmission.submissionCount}) by ${submitterName}!`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in POST /api/teams/submission:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
