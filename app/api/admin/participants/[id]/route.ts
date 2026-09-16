import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAllowedDomain } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
    }

    const participant = await prisma.participant.findUnique({
      where: { id: params.id },
      include: {
        team: {
          select: { id: true, name: true },
        },
      },
    });

    if (!participant) {
      return NextResponse.json({ error: "Participant not found." }, { status: 404 });
    }

    return NextResponse.json({ participant });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in GET /api/admin/participants/[id]:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
    }

    const participantId = params.id;
    const body = await req.json();
    const { studentId, name, email, gender, phone, year, category, teamId } = body;

    const existing = await prisma.participant.findUnique({
      where: { id: participantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Participant not found." }, { status: 404 });
    }

    const cleanStudentId = studentId ? String(studentId).trim() : existing.studentId;
    const cleanName = name ? String(name).trim() : existing.name;
    const cleanEmail = email ? String(email).toLowerCase().trim() : existing.email;
    const cleanGender = gender ? String(gender).trim() : existing.gender;
    const cleanPhone = phone ? String(phone).trim() : existing.phone;
    const cleanYear = year ? String(year).trim() : existing.year;
    const cleanCategory = category === "CS" || category === "NonCS" ? category : existing.category;

    if (!cleanStudentId) return NextResponse.json({ error: "Student ID is required." }, { status: 400 });
    if (!cleanName) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!cleanEmail || !cleanEmail.includes("@")) return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    if (!isAllowedDomain(cleanEmail)) {
      return NextResponse.json({ error: `Email domain must match ${process.env.ORG_DOMAIN || "@kiot.ac.in"}` }, { status: 400 });
    }

    // Check studentId uniqueness if changed
    if (cleanStudentId !== existing.studentId) {
      const dupId = await prisma.participant.findUnique({ where: { studentId: cleanStudentId } });
      if (dupId && dupId.id !== participantId) {
        return NextResponse.json({ error: `Student ID "${cleanStudentId}" is already assigned to another participant.` }, { status: 400 });
      }
    }

    // Check email uniqueness if changed
    if (cleanEmail !== existing.email) {
      const dupEmail = await prisma.participant.findUnique({ where: { email: cleanEmail } });
      if (dupEmail && dupEmail.id !== participantId) {
        return NextResponse.json({ error: `Email "${cleanEmail}" is already registered to another participant.` }, { status: 400 });
      }
    }

    // Team assignment verification if teamId provided
    let finalTeamId: string | null = existing.teamId;
    if (teamId !== undefined) {
      if (teamId === null || teamId === "" || teamId === "none") {
        finalTeamId = null;
      } else {
        const teamExists = await prisma.team.findUnique({ where: { id: teamId } });
        if (!teamExists) {
          return NextResponse.json({ error: "Selected team does not exist." }, { status: 400 });
        }
        finalTeamId = teamId;
      }
    }

    const updated = await prisma.participant.update({
      where: { id: participantId },
      data: {
        studentId: cleanStudentId,
        name: cleanName,
        email: cleanEmail,
        gender: cleanGender,
        phone: cleanPhone,
        year: cleanYear,
        category: cleanCategory,
        teamId: finalTeamId,
      },
      include: {
        team: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      participant: updated,
      message: "Participant updated successfully.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in PUT /api/admin/participants/[id]:", err);
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

    const participantId = params.id;

    const existing = await prisma.participant.findUnique({
      where: { id: participantId },
      include: { team: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Participant not found." }, { status: 404 });
    }

    await prisma.participant.delete({
      where: { id: participantId },
    });

    return NextResponse.json({
      success: true,
      message: `Participant "${existing.name}" (${existing.studentId}) deleted successfully.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in DELETE /api/admin/participants/[id]:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
