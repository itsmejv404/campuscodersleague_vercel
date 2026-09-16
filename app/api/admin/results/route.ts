import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format");

    const teams = await prisma.team.findMany({
      include: {
        members: {
          select: {
            id: true,
            studentId: true,
            name: true,
            email: true,
            phone: true,
            gender: true,
            year: true,
            category: true,
          },
          orderBy: [{ category: "asc" }, { name: "asc" }],
        },
        submission: {
          select: {
            id: true,
            pdfUrl: true,
            fileName: true,
            fileSize: true,
            submitterName: true,
            submitterEmail: true,
            submitterStudentId: true,
            submittedAt: true,
            submissionCount: true,
          },
        },
        _count: {
          select: { votes: true },
        },
      },
    });

    // Total votes across all teams
    const totalVotes = teams.reduce((acc, t) => acc + (t._count.votes || 0), 0);

    // Sort by vote count descending, then team name
    teams.sort((a, b) => {
      const diff = b._count.votes - a._count.votes;
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });

    const results = teams.map((team, idx) => {
      const s1 = team.members[0];
      const s2 = team.members[1];
      const s3 = team.members[2];
      const s4 = team.members[3];

      const votes = team._count.votes;
      const percentageNumber = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
      const percentageString = `${percentageNumber.toFixed(2)}%`;

      const sub = team.submission;
      const isSubmitted = !!sub;
      const submittedByText = sub
        ? `${sub.submitterName} (${sub.submitterEmail}${sub.submitterStudentId ? ` - ${sub.submitterStudentId}` : ""})`
        : "NOT SUBMITTED";

      return {
        rank: idx + 1,
        teamId: team.id,
        teamName: team.name,
        voteCount: votes,
        votePercentage: percentageNumber,
        votePercentageDisplay: percentageString,
        isSubmitted,
        submission: sub,
        submittedByText,
        createdAt: team.createdAt,
        student1: s1 ? `${s1.name} (${s1.category === "CS" ? "CS" : "Core"} - ${s1.email} / ${s1.phone})` : "N/A",
        student2: s2 ? `${s2.name} (${s2.category === "CS" ? "CS" : "Core"} - ${s2.email} / ${s2.phone})` : "N/A",
        student3: s3 ? `${s3.name} (${s3.category === "CS" ? "CS" : "Core"} - ${s3.email} / ${s3.phone})` : "N/A",
        student4: s4 ? `${s4.name} (${s4.category === "CS" ? "CS" : "Core"} - ${s4.email} / ${s4.phone})` : "N/A",
        members: team.members,
      };
    });

    // Helper for uppercase category label
    const formatCategory = (cat?: string) => {
      if (!cat) return "";
      return cat === "CS" ? "CS" : "CORE";
    };

    // Helper for formatting date strings in uppercase
    const formatSubmissionDate = (d?: Date | null) => {
      if (!d) return "N/A";
      return new Date(d).toISOString().replace("T", " ").substring(0, 19);
    };

    // Handle CSV export request - ALL DETAILS IN UPPERCASE
    if (format === "csv") {
      const headers = [
        "S.NO",
        "TEAM NAME",
        "VOTE COUNT",
        "VOTE PERCENTAGE",
        "SUBMISSION STATUS",
        "SUBMITTED BY",
        "SUBMISSION FILE",
        "SUBMISSION TIME",
        "STUDENT 1 NAME",
        "STUDENT 1 EMAIL",
        "STUDENT 1 PHONE",
        "STUDENT 1 CATEGORY",
        "STUDENT 2 NAME",
        "STUDENT 2 EMAIL",
        "STUDENT 2 PHONE",
        "STUDENT 2 CATEGORY",
        "STUDENT 3 NAME",
        "STUDENT 3 EMAIL",
        "STUDENT 3 PHONE",
        "STUDENT 3 CATEGORY",
        "STUDENT 4 NAME",
        "STUDENT 4 EMAIL",
        "STUDENT 4 PHONE",
        "STUDENT 4 CATEGORY",
      ];

      const csvRows = [headers.join(",")];

      results.forEach((r) => {
        const sub = r.submission;
        const row = [
          r.rank,
          `"${r.teamName.toUpperCase().replace(/"/g, '""')}"`,
          r.voteCount,
          `"${r.votePercentageDisplay}"`,
          `"${(r.isSubmitted ? "SUBMITTED" : "PENDING").toUpperCase()}"`,
          `"${(r.submittedByText || "").toUpperCase().replace(/"/g, '""')}"`,
          `"${(sub?.fileName || "N/A").toUpperCase().replace(/"/g, '""')}"`,
          `"${formatSubmissionDate(sub?.submittedAt)}"`,
          `"${(r.members[0]?.name || "").toUpperCase().replace(/"/g, '""')}"`,
          `"${(r.members[0]?.email || "").toUpperCase().replace(/"/g, '""')}"`,
          `"${(r.members[0]?.phone || "").toUpperCase().replace(/"/g, '""')}"`,
          `"${formatCategory(r.members[0]?.category)}"`,
          `"${(r.members[1]?.name || "").toUpperCase().replace(/"/g, '""')}"`,
          `"${(r.members[1]?.email || "").toUpperCase().replace(/"/g, '""')}"`,
          `"${(r.members[1]?.phone || "").toUpperCase().replace(/"/g, '""')}"`,
          `"${formatCategory(r.members[1]?.category)}"`,
          `"${(r.members[2]?.name || "").toUpperCase().replace(/"/g, '""')}"`,
          `"${(r.members[2]?.email || "").toUpperCase().replace(/"/g, '""')}"`,
          `"${(r.members[2]?.phone || "").toUpperCase().replace(/"/g, '""')}"`,
          `"${formatCategory(r.members[2]?.category)}"`,
          `"${(r.members[3]?.name || "").toUpperCase().replace(/"/g, '""')}"`,
          `"${(r.members[3]?.email || "").toUpperCase().replace(/"/g, '""')}"`,
          `"${(r.members[3]?.phone || "").toUpperCase().replace(/"/g, '""')}"`,
          `"${formatCategory(r.members[3]?.category)}"`,
        ];
        csvRows.push(row.join(","));
      });

      const csvContent = csvRows.join("\n");
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="CAMPUS-CODERS-LEAGUE-RESULTS.csv"',
        },
      });
    }

    // Handle Excel (.xlsx) export request - ALL DETAILS IN UPPERCASE
    if (format === "xlsx") {
      const sheetData = results.map((r) => {
        const sub = r.submission;
        return {
          "S.NO": r.rank,
          "TEAM NAME": r.teamName.toUpperCase(),
          "VOTE COUNT": r.voteCount,
          "VOTE PERCENTAGE": r.votePercentageDisplay,
          "SUBMISSION STATUS": r.isSubmitted ? "SUBMITTED" : "PENDING",
          "SUBMITTED BY": (r.submittedByText || "").toUpperCase(),
          "SUBMISSION FILE": (sub?.fileName || "N/A").toUpperCase(),
          "SUBMISSION TIME": formatSubmissionDate(sub?.submittedAt),
          "STUDENT 1 NAME": (r.members[0]?.name || "").toUpperCase(),
          "STUDENT 1 EMAIL": (r.members[0]?.email || "").toUpperCase(),
          "STUDENT 1 PHONE": (r.members[0]?.phone || "").toUpperCase(),
          "STUDENT 1 CATEGORY": formatCategory(r.members[0]?.category),
          "STUDENT 2 NAME": (r.members[1]?.name || "").toUpperCase(),
          "STUDENT 2 EMAIL": (r.members[1]?.email || "").toUpperCase(),
          "STUDENT 2 PHONE": (r.members[1]?.phone || "").toUpperCase(),
          "STUDENT 2 CATEGORY": formatCategory(r.members[1]?.category),
          "STUDENT 3 NAME": (r.members[2]?.name || "").toUpperCase(),
          "STUDENT 3 EMAIL": (r.members[2]?.email || "").toUpperCase(),
          "STUDENT 3 PHONE": (r.members[2]?.phone || "").toUpperCase(),
          "STUDENT 3 CATEGORY": formatCategory(r.members[2]?.category),
          "STUDENT 4 NAME": (r.members[3]?.name || "").toUpperCase(),
          "STUDENT 4 EMAIL": (r.members[3]?.email || "").toUpperCase(),
          "STUDENT 4 PHONE": (r.members[3]?.phone || "").toUpperCase(),
          "STUDENT 4 CATEGORY": formatCategory(r.members[3]?.category),
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, "RESULTS");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="CAMPUS-CODERS-LEAGUE-RESULTS.xlsx"',
        },
      });
    }

    return NextResponse.json({
      totalTeams: results.length,
      totalVotes,
      results,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in GET /api/admin/results:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
