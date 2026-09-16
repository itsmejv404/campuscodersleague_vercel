import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/types/next-auth";

export function isAllowedDomain(email: string): boolean {
  const orgDomains = (process.env.ORG_DOMAIN || "@kiot.ac.in,@examly.in")
    .split(",")
    .map((d) => d.toLowerCase().trim())
    .filter(Boolean)
    .map((d) => (d.startsWith("@") ? d : `@${d}`));
  const normalizedEmail = email.toLowerCase().trim();
  return orgDomains.some((domain) => normalizedEmail.endsWith(domain));
}

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const authOptions: NextAuthOptions = {
  useSecureCookies: process.env.NEXTAUTH_URL?.startsWith("https://") ?? false,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  providers: [
    CredentialsProvider({
      id: "email-otp",
      name: "Email OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.code) {
          throw new Error("Email and OTP code are required.");
        }

        const email = credentials.email.toLowerCase().trim();
        const code = credentials.code.trim();

        if (!isAllowedDomain(email)) {
          throw new Error(
            `Access restricted. Only emails matching ${process.env.ORG_DOMAIN || "@kiot.ac.in"} are permitted.`
          );
        }

        // Find the latest active OTP token for this email
        const tokenRecord = await prisma.otpToken.findFirst({
          where: {
            email,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: "desc" },
        });

        if (!tokenRecord) {
          throw new Error("Invalid or expired verification code. Please request a new one.");
        }

        const isMatch = await bcrypt.compare(code, tokenRecord.tokenHash);
        if (!isMatch) {
          throw new Error("Invalid verification code. Please check and try again.");
        }

        // Consume all tokens for this email to prevent reuse
        await prisma.otpToken.deleteMany({
          where: { email },
        });

        // Resolve User Role
        const adminEmails = getAdminEmails();
        let role: UserRole = "VOTER";
        let participantId: string | null = null;
        let studentId: string | null = null;
        let category: "CS" | "NonCS" | null = null;
        let teamId: string | null = null;
        let name: string = email.split("@")[0];

        if (adminEmails.includes(email)) {
          role = "ADMIN";
        }

        // Check if there is an existing participant record with this email
        const participant = await prisma.participant.findUnique({
          where: { email },
        });

        if (participant) {
          if (role !== "ADMIN") {
            role = "PARTICIPANT";
          }
          participantId = participant.id;
          studentId = participant.studentId;
          category = participant.category as "CS" | "NonCS";
          teamId = participant.teamId;
          name = participant.name;
        }

        // Find or create User record in DB
        const user = await prisma.user.upsert({
          where: { email },
          update: { role },
          create: {
            email,
            role,
          },
        });

        return {
          id: user.id,
          email: user.email,
          role,
          name,
          participantId,
          studentId,
          category,
          teamId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.role = user.role;
        token.name = user.name;
        token.participantId = user.participantId;
        token.studentId = user.studentId;
        token.category = user.category;
        token.teamId = user.teamId;
      } else if (token.email) {
        // Dynamically synchronize role & participant details on JWT check
        try {
          const userEmail = (token.email as string).toLowerCase().trim();
          const adminEmails = getAdminEmails();
          const isAdmin = adminEmails.includes(userEmail);

          const participant = await prisma.participant.findUnique({
            where: { email: userEmail },
            select: {
              id: true,
              studentId: true,
              name: true,
              category: true,
              teamId: true,
            },
          });

          if (isAdmin) {
            token.role = "ADMIN";
          } else if (participant) {
            token.role = "PARTICIPANT";
          } else {
            token.role = "VOTER";
          }

          if (participant) {
            token.participantId = participant.id;
            token.studentId = participant.studentId;
            token.name = participant.name;
            token.category = participant.category;
            token.teamId = participant.teamId;
          } else {
            token.participantId = null;
            token.studentId = null;
            token.category = null;
            token.teamId = null;
          }
        } catch {
          // Fallback to existing token values if DB connection is temporarily unavailable
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.role = token.role as UserRole;
        session.user.name = token.name as string;
        session.user.participantId = token.participantId as string | null;
        session.user.studentId = token.studentId as string | null;
        session.user.category = token.category as "CS" | "NonCS" | null;
        session.user.teamId = token.teamId as string | null;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-dev-secret-replace-in-production",
};
