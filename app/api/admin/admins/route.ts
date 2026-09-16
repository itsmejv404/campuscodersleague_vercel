import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getMasterAdminEmail, isMasterAdminEmail, isAllowedDomain } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

const addAdminSchema = z.object({
  email: z.string().email().min(3),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Admin role required." },
        { status: 403 }
      );
    }

    const masterEmail = getMasterAdminEmail();
    const currentUserEmail = session.user.email?.toLowerCase().trim() || "";
    const isMaster = isMasterAdminEmail(currentUserEmail);

    // Fetch all users with role ADMIN
    const dbAdmins = await prisma.user.findMany({
      where: { role: Role.ADMIN },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    // Ensure Master Admin exists in list (upserting if not present in dbAdmins)
    let masterFound = dbAdmins.some(
      (a) => a.email.toLowerCase().trim() === masterEmail
    );

    if (!masterFound) {
      const masterUser = await prisma.user.upsert({
        where: { email: masterEmail },
        update: { role: Role.ADMIN },
        create: { email: masterEmail, role: Role.ADMIN },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });
      dbAdmins.unshift(masterUser);
    }

    // Collect emails to query matching participant info
    const adminEmails = dbAdmins.map((a) => a.email.toLowerCase().trim());
    const participants = await prisma.participant.findMany({
      where: {
        email: { in: adminEmails },
      },
      select: {
        email: true,
        name: true,
        studentId: true,
        category: true,
      },
    });

    const participantMap = new Map(
      participants.map((p) => [p.email.toLowerCase().trim(), p])
    );

    const formattedAdmins = dbAdmins.map((a) => {
      const emailLower = a.email.toLowerCase().trim();
      const isThisMaster = emailLower === masterEmail;
      const part = participantMap.get(emailLower);

      return {
        id: a.id,
        email: a.email,
        role: a.role,
        isMasterAdmin: isThisMaster,
        createdAt: a.createdAt,
        name: part?.name || null,
        studentId: part?.studentId || null,
        category: part?.category || null,
      };
    });

    // Sort master admin to top, then alphabetical by email
    formattedAdmins.sort((a, b) => {
      if (a.isMasterAdmin) return -1;
      if (b.isMasterAdmin) return 1;
      return a.email.localeCompare(b.email);
    });

    return NextResponse.json({
      admins: formattedAdmins,
      masterAdminEmail: masterEmail,
      isCurrentUserMasterAdmin: isMaster,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in GET /api/admin/admins:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Admin role required." },
        { status: 403 }
      );
    }

    const currentUserEmail = session.user.email?.toLowerCase().trim() || "";
    if (!isMasterAdminEmail(currentUserEmail)) {
      return NextResponse.json(
        { error: "Forbidden. Only the Master Admin can appoint new administrators." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parseResult = addAdminSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid email format provided." },
        { status: 400 }
      );
    }

    const targetEmail = parseResult.data.email.toLowerCase().trim();

    if (!isAllowedDomain(targetEmail)) {
      return NextResponse.json(
        {
          error: `Domain not allowed. Email must match permitted institutional domain (${process.env.ORG_DOMAIN || "@kiot.ac.in"}).`,
        },
        { status: 400 }
      );
    }

    // Upsert user with ADMIN role
    const updatedUser = await prisma.user.upsert({
      where: { email: targetEmail },
      update: { role: Role.ADMIN },
      create: {
        email: targetEmail,
        role: Role.ADMIN,
      },
    });

    return NextResponse.json({
      message: `Admin access granted successfully to ${targetEmail}`,
      user: updatedUser,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in POST /api/admin/admins:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Admin role required." },
        { status: 403 }
      );
    }

    const currentUserEmail = session.user.email?.toLowerCase().trim() || "";
    if (!isMasterAdminEmail(currentUserEmail)) {
      return NextResponse.json(
        { error: "Forbidden. Only the Master Admin can revoke administrator privileges." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parseResult = addAdminSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid email format provided." },
        { status: 400 }
      );
    }

    const targetEmail = parseResult.data.email.toLowerCase().trim();
    const masterEmail = getMasterAdminEmail();

    if (targetEmail === masterEmail) {
      return NextResponse.json(
        { error: "Cannot revoke permissions from the Master Admin." },
        { status: 400 }
      );
    }

    // Check if the user is registered as a participant
    const participant = await prisma.participant.findUnique({
      where: { email: targetEmail },
    });

    const fallbackRole = participant ? Role.PARTICIPANT : Role.VOTER;

    // Update user role in database
    await prisma.user.updateMany({
      where: { email: targetEmail },
      data: { role: fallbackRole },
    });

    return NextResponse.json({
      message: `Admin privileges revoked for ${targetEmail}. Role reset to ${fallbackRole}.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in DELETE /api/admin/admins:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
