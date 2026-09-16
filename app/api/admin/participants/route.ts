import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAllowedDomain } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() || "";
    const category = searchParams.get("category")?.trim();
    const hasTeam = searchParams.get("hasTeam");

    const whereClause: Record<string, unknown> = {};

    if (category && (category === "CS" || category === "NonCS")) {
      whereClause.category = category;
    }

    if (hasTeam === "true") {
      whereClause.teamId = { not: null };
    } else if (hasTeam === "false") {
      whereClause.teamId = null;
    }

    if (query) {
      whereClause.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { studentId: { contains: query, mode: "insensitive" } },
      ];
    }

    const participants = await prisma.participant.findMany({
      where: whereClause,
      include: {
        team: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    });

    const totalCount = await prisma.participant.count({ where: whereClause });

    return NextResponse.json({
      participants,
      totalCount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in GET /api/admin/participants:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const body = await req.json();
    const { studentId, name, email, gender, phone, year, category } = body;

    const cleanStudentId = String(studentId || "").trim();
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").toLowerCase().trim();
    const cleanGender = String(gender || "Unspecified").trim();
    const cleanPhone = String(phone || "N/A").trim();
    const cleanYear = String(year || "II Year").trim();
    const cleanCategory = category === "CS" || category === "NonCS" ? category : null;

    if (!cleanStudentId) {
      return NextResponse.json({ error: "Student ID is required." }, { status: 400 });
    }
    if (!cleanName) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }
    if (!isAllowedDomain(cleanEmail)) {
      return NextResponse.json(
        { error: `Email domain must match ${process.env.ORG_DOMAIN || "@kiot.ac.in"}` },
        { status: 400 }
      );
    }
    if (!cleanCategory) {
      return NextResponse.json({ error: "Category must be either CS or NonCS." }, { status: 400 });
    }

    // Check studentId uniqueness
    const existingById = await prisma.participant.findUnique({
      where: { studentId: cleanStudentId },
    });
    if (existingById) {
      return NextResponse.json(
        { error: `Student ID "${cleanStudentId}" already exists.` },
        { status: 400 }
      );
    }

    // Check email uniqueness
    const existingByEmail = await prisma.participant.findUnique({
      where: { email: cleanEmail },
    });
    if (existingByEmail) {
      return NextResponse.json(
        { error: `Participant with email "${cleanEmail}" already exists.` },
        { status: 400 }
      );
    }

    const participant = await prisma.participant.create({
      data: {
        studentId: cleanStudentId,
        name: cleanName,
        email: cleanEmail,
        gender: cleanGender,
        phone: cleanPhone,
        year: cleanYear,
        category: cleanCategory,
      },
      include: {
        team: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      participant,
      message: `Participant "${participant.name}" created successfully.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in POST /api/admin/participants:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

