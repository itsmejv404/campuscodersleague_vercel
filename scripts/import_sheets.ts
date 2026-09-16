import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { PrismaClient, Category } from "@prisma/client";

const prisma = new PrismaClient();

interface CleanedParticipant {
  studentId: string;
  name: string;
  email: string;
  gender: string;
  phone: string;
  year: string;
  category: Category;
  department: string;
}

export async function importAllSheets() {
  console.log("📂 Reading sheets from directory:", path.join(process.cwd(), "Sheets"));
  const sheetsDir = path.join(process.cwd(), "Sheets");

  if (!fs.existsSync(sheetsDir)) {
    console.error("❌ Sheets directory not found at", sheetsDir);
    return;
  }

  const files = fs
    .readdirSync(sheetsDir)
    .filter((f) => f.endsWith(".csv"))
    .sort();

  console.log(`Found ${files.length} CSV files.`);

  const allRecords: CleanedParticipant[] = [];
  const skippedRows: Array<{ file: string; reason: string; row: unknown }> = [];

  for (const file of files) {
    const fullPath = path.join(sheetsDir, file);
    const content = fs.readFileSync(fullPath, "utf8");
    const parsed = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
    });

    // Department categorization rules:
    // CSE, CSBS, AI&DS, IT are CS.
    // Others (ECE, ECX, EEE, Civil, Mech, MCA) are NonCS (Core).
    let category: Category = Category.NonCS;
    let deptName = "Core";

    const fUpper = file.toUpperCase();
    if (fUpper.includes("CSE")) {
      category = Category.CS;
      deptName = "CSE";
    } else if (fUpper.includes("CSBS")) {
      category = Category.CS;
      deptName = "CSBS";
    } else if (fUpper.includes("AI&DS") || fUpper.includes("AIDS")) {
      category = Category.CS;
      deptName = "AI&DS";
    } else if (fUpper.includes("IT")) {
      category = Category.CS;
      deptName = "IT";
    } else if (fUpper.includes("ECE")) {
      deptName = "ECE";
    } else if (fUpper.includes("ECX")) {
      deptName = "ECX";
    } else if (fUpper.includes("EEE")) {
      deptName = "EEE";
    } else if (fUpper.includes("CIVIL")) {
      deptName = "Civil";
    } else if (fUpper.includes("MECH")) {
      deptName = "Mech";
    } else if (fUpper.includes("MCA")) {
      deptName = "MCA";
    }

    parsed.data.forEach((row) => {
      const studentId = (row["Student ID"] || row["StudentID"] || "").trim();
      const name = (row["Name"] || "").replace(/\s+/g, " ").trim();
      const email = (row["Email"] || "").trim().toLowerCase();
      const gender = (row["Gender"] || "Unspecified").trim();
      const phone = (row["Phone No"] || row["Phone"] || "N/A").trim();
      let year = (row["Year"] || "II Year").trim();
      if (!year || year.toLowerCase() === "not identified") {
        year = "II Year";
      }

      // Filter out footer rows (e.g. "Return mail Sent Count :", "Not Willing Count :")
      if (!studentId || !name || !email) {
        skippedRows.push({ file, reason: "Missing required fields or summary row", row });
        return;
      }

      if (
        name.toLowerCase().includes("count") ||
        studentId.toLowerCase().includes("count") ||
        email.includes("count") ||
        !email.includes("@")
      ) {
        skippedRows.push({ file, reason: "Summary or invalid email row", row });
        return;
      }

      allRecords.push({
        studentId,
        name,
        email,
        gender: gender || "Unspecified",
        phone: phone || "N/A",
        year,
        category,
        department: deptName,
      });
    });
  }

  console.log(`\n🔍 Parsed ${allRecords.length} student records from sheets.`);
  console.log(`Skipped ${skippedRows.length} non-student / summary rows.`);

  const csCount = allRecords.filter((r) => r.category === Category.CS).length;
  const nonCsCount = allRecords.filter((r) => r.category === Category.NonCS).length;
  console.log(`📊 Category Distribution: ${csCount} CS, ${nonCsCount} Core (NonCS)\n`);

  console.log("💾 Upserting records into Supabase PostgreSQL...");

  let upserted = 0;
  for (const item of allRecords) {
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
    upserted++;
  }

  console.log(`✅ Successfully imported and synchronized all ${upserted} participants into the database!\n`);
}

importAllSheets()
  .catch((err) => {
    console.error("❌ Failed to import sheets:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
