import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAllowedDomain } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

interface ParsedRow {
  studentId: string;
  name: string;
  email: string;
  gender: string;
  phone: string;
  year: string;
  category: "CS" | "NonCS";
}

interface RowError {
  rowNumber: number;
  data: Record<string, unknown>;
  errors: string[];
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeCategory(raw: unknown): "CS" | "NonCS" | null {
  if (!raw) return null;
  const str = String(raw).trim().toLowerCase();
  if (
    str === "cs" ||
    str === "computer science" ||
    str === "cse" ||
    str === "csbs" ||
    str === "ai&ds" ||
    str === "aids" ||
    str === "ai and ds" ||
    str === "ai/ds" ||
    str === "it" ||
    str === "information technology"
  ) {
    return "CS";
  }
  if (
    str === "noncs" ||
    str === "non-cs" ||
    str === "other" ||
    str === "non cs" ||
    str === "core" ||
    str === "ece" ||
    str === "ecx" ||
    str === "eee" ||
    str === "civil" ||
    str === "mech" ||
    str === "mechanical" ||
    str === "mca"
  ) {
    return "NonCS";
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const shouldCommit = searchParams.get("commit") === "true";

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return NextResponse.json({ error: "Spreadsheet contains no sheets." }, { status: 400 });
    }

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheetName]);

    if (!rawRows || rawRows.length === 0) {
      return NextResponse.json({ error: "The spreadsheet is empty." }, { status: 400 });
    }

    const validRows: ParsedRow[] = [];
    const invalidRows: RowError[] = [];
    const seenEmails = new Set<string>();
    const seenStudentIds = new Set<string>();

    rawRows.forEach((row, idx) => {
      const rowNum = idx + 2; // Accounting for 1-based index and header row
      const errors: string[] = [];

      // Map flexible column header variations
      const normalizedRow: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        normalizedRow[normalizeKey(key)] = value;
      }

      const studentId = String(
        normalizedRow["studentid"] ||
        normalizedRow["id"] ||
        normalizedRow["rollno"] ||
        ""
      ).trim();

      const name = String(
        normalizedRow["name"] ||
        normalizedRow["fullname"] ||
        normalizedRow["studentname"] ||
        ""
      ).trim();

      const email = String(
        normalizedRow["email"] ||
        normalizedRow["emailaddress"] ||
        ""
      ).toLowerCase().trim();

      const gender = String(
        normalizedRow["gender"] ||
        normalizedRow["sex"] ||
        ""
      ).trim();

      const phone = String(
        normalizedRow["phone"] ||
        normalizedRow["phonenumber"] ||
        normalizedRow["mobile"] ||
        ""
      ).trim();

      const year = String(
        normalizedRow["year"] ||
        normalizedRow["class"] ||
        normalizedRow["gradyear"] ||
        ""
      ).trim();

      const rawCat = normalizedRow["category"] || normalizedRow["branch"] || normalizedRow["stream"];
      const category = normalizeCategory(rawCat);

      // Validation rules
      if (!studentId) errors.push("Missing StudentID");
      if (!name) errors.push("Missing Name");
      if (!email) {
        errors.push("Missing Email");
      } else {
        if (!email.includes("@")) {
          errors.push("Invalid email format");
        } else if (!isAllowedDomain(email)) {
          errors.push(`Email domain must match ${process.env.ORG_DOMAIN || "@kiot.ac.in"}`);
        }
      }

      if (!gender) errors.push("Missing Gender");
      if (!phone) errors.push("Missing Phone");
      if (!year) errors.push("Missing Year");
      if (!category) {
        errors.push(`Invalid Category "${rawCat || ""}". Must be "CS" or "NonCS"`);
      }

      // Check duplicates inside the batch
      if (email && seenEmails.has(email)) {
        errors.push(`Duplicate email "${email}" in file`);
      }
      if (studentId && seenStudentIds.has(studentId)) {
        errors.push(`Duplicate StudentID "${studentId}" in file`);
      }

      if (errors.length > 0) {
        invalidRows.push({
          rowNumber: rowNum,
          data: row,
          errors,
        });
      } else {
        seenEmails.add(email);
        seenStudentIds.add(studentId);
        validRows.push({
          studentId,
          name,
          email,
          gender,
          phone,
          year,
          category: category!,
        });
      }
    });

    // If not committing, return preview report
    if (!shouldCommit) {
      return NextResponse.json({
        totalRows: rawRows.length,
        validCount: validRows.length,
        invalidCount: invalidRows.length,
        validRows: validRows.slice(0, 50), // Send first 50 for preview
        invalidRows,
      });
    }

    // If committing, upsert all valid rows
    let upsertedCount = 0;
    const commitErrors: string[] = [];

    for (const item of validRows) {
      try {
        await prisma.participant.upsert({
          where: { studentId: item.studentId },
          update: {
            name: item.name,
            email: item.email,
            gender: item.gender,
            phone: item.phone,
            year: item.year,
            category: item.category,
          },
          create: {
            studentId: item.studentId,
            name: item.name,
            email: item.email,
            gender: item.gender,
            phone: item.phone,
            year: item.year,
            category: item.category,
          },
        });
        upsertedCount++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Upsert failed";
        commitErrors.push(`Failed to upsert ${item.studentId} (${item.email}): ${msg}`);
      }
    }

    return NextResponse.json({
      success: true,
      totalRows: rawRows.length,
      upsertedCount,
      failedCount: commitErrors.length,
      commitErrors,
      message: `Successfully processed ${upsertedCount} participants.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in POST /api/admin/participants/upload:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
