import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const windowSchema = z.object({
  startsAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
  endsAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
  isActive: z.boolean(),
});

export async function GET() {
  try {
    const window = await prisma.votingWindow.findFirst({
      orderBy: { createdAt: "desc" },
    });

    let status: "not_configured" | "upcoming" | "active" | "closed" | "disabled" = "not_configured";

    if (window) {
      const now = new Date();
      if (!window.isActive) {
        status = "disabled";
      } else if (now < window.startsAt) {
        status = "upcoming";
      } else if (now > window.endsAt) {
        status = "closed";
      } else {
        status = "active";
      }
    }

    return NextResponse.json({ window, status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in GET /api/admin/voting-window:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const body = await req.json();
    const parseResult = windowSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid date format or parameters provided." },
        { status: 400 }
      );
    }

    const { startsAt, endsAt, isActive } = parseResult.data;
    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Invalid dates provided." }, { status: 400 });
    }

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: "Start time must be strictly before end time." },
        { status: 400 }
      );
    }

    // Deactivate previous windows if setting a new active one
    if (isActive) {
      await prisma.votingWindow.updateMany({
        data: { isActive: false },
      });
    }

    // Check if an existing window exists to update, or create new
    const existing = await prisma.votingWindow.findFirst({
      orderBy: { createdAt: "desc" },
    });

    let saved;
    if (existing) {
      saved = await prisma.votingWindow.update({
        where: { id: existing.id },
        data: {
          startsAt: startDate,
          endsAt: endDate,
          isActive,
        },
      });
    } else {
      saved = await prisma.votingWindow.create({
        data: {
          startsAt: startDate,
          endsAt: endDate,
          isActive,
        },
      });
    }

    return NextResponse.json({
      success: true,
      window: saved,
      message: "Voting window configuration saved successfully.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in PUT /api/admin/voting-window:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
