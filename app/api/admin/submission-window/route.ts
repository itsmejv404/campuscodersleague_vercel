import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let windowRecord = await prisma.submissionWindow.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!windowRecord) {
      windowRecord = await prisma.submissionWindow.create({
        data: {
          isOpen: true,
          isActive: true,
        },
      });
    }

    const now = new Date();
    let status = "closed";

    if (!windowRecord.isOpen || !windowRecord.isActive) {
      status = "closed";
    } else if (windowRecord.startsAt && now < windowRecord.startsAt) {
      status = "upcoming";
    } else if (windowRecord.endsAt && now > windowRecord.endsAt) {
      status = "closed";
    } else {
      status = "open";
    }

    return NextResponse.json({
      window: windowRecord,
      status,
      isOpen: status === "open",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in GET /api/admin/submission-window:", err);
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
    const { isOpen, isActive, startsAt, endsAt } = body;

    let windowRecord = await prisma.submissionWindow.findFirst({
      orderBy: { createdAt: "desc" },
    });

    const dataPayload: {
      isOpen?: boolean;
      isActive?: boolean;
      startsAt?: Date | null;
      endsAt?: Date | null;
    } = {};

    if (typeof isOpen === "boolean") dataPayload.isOpen = isOpen;
    if (typeof isActive === "boolean") dataPayload.isActive = isActive;
    if (startsAt !== undefined) dataPayload.startsAt = startsAt ? new Date(startsAt) : null;
    if (endsAt !== undefined) dataPayload.endsAt = endsAt ? new Date(endsAt) : null;

    if (windowRecord) {
      windowRecord = await prisma.submissionWindow.update({
        where: { id: windowRecord.id },
        data: dataPayload,
      });
    } else {
      windowRecord = await prisma.submissionWindow.create({
        data: {
          isOpen: typeof isOpen === "boolean" ? isOpen : true,
          isActive: typeof isActive === "boolean" ? isActive : true,
          startsAt: startsAt ? new Date(startsAt) : null,
          endsAt: endsAt ? new Date(endsAt) : null,
        },
      });
    }

    const now = new Date();
    let status = "closed";
    if (!windowRecord.isOpen || !windowRecord.isActive) {
      status = "closed";
    } else if (windowRecord.startsAt && now < windowRecord.startsAt) {
      status = "upcoming";
    } else if (windowRecord.endsAt && now > windowRecord.endsAt) {
      status = "closed";
    } else {
      status = "open";
    }

    return NextResponse.json({
      success: true,
      window: windowRecord,
      status,
      isOpen: status === "open",
      message: status === "open" ? "Submissions are now OPEN." : "Submissions are now CLOSED.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in PUT /api/admin/submission-window:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
