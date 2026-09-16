import { DefaultSession } from "next-auth";

export type UserRole = "ADMIN" | "PARTICIPANT" | "VOTER";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      role: UserRole;
      name?: string | null;
      participantId?: string | null;
      studentId?: string | null;
      category?: "CS" | "NonCS" | null;
      teamId?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    email: string;
    role: UserRole;
    name?: string | null;
    participantId?: string | null;
    studentId?: string | null;
    category?: "CS" | "NonCS" | null;
    teamId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    role: UserRole;
    name?: string | null;
    participantId?: string | null;
    studentId?: string | null;
    category?: "CS" | "NonCS" | null;
    teamId?: string | null;
  }
}
