import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() || "";
    const category = searchParams.get("category")?.trim();

    const whereClause: Record<string, unknown> = {
      teamId: null, // Only participants not already assigned to any team
    };

    if (category && (category === "CS" || category === "NonCS")) {
      whereClause.category = category;
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
      select: {
        id: true,
        studentId: true,
        name: true,
        email: true,
        gender: true,
        phone: true,
        year: true,
        category: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      take: 1000,
    });

    return NextResponse.json({ participants });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in /api/participants/available:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
