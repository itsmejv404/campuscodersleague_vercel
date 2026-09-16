import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isAllowedDomain } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/mail";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawEmail = body.email;

    if (!rawEmail || typeof rawEmail !== "string") {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    const email = rawEmail.toLowerCase().trim();
    const orgDomains = (process.env.ORG_DOMAIN || "@kiot.ac.in,@examly.in")
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);

    if (!isAllowedDomain(email)) {
      return NextResponse.json(
        {
          error: `Domain restricted. Only email addresses ending with ${orgDomains.join(" or ")} are permitted to sign in.`,
        },
        { status: 400 }
      );
    }

    // Generate secure 6-digit numeric OTP
    const code = crypto.randomInt(100000, 1000000).toString();
    const salt = await bcrypt.genSalt(10);
    const tokenHash = await bcrypt.hash(code, salt);

    // 10 minutes expiry window
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Invalidate old tokens for this email
    await prisma.otpToken.deleteMany({
      where: { email },
    });

    // Save token
    await prisma.otpToken.create({
      data: {
        email,
        tokenHash,
        expiresAt,
      },
    });

    // Send email via configured SMTP service
    const mailResult = await sendOtpEmail(email, code);

    if (!mailResult.success) {
      return NextResponse.json(
        { error: mailResult.error || "Failed to send verification email. Please try again later." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Verification code sent to ${email}. Please check your inbox.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in /api/auth/otp/request:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
