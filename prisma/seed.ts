import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { PrismaClient, Role, Category } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Team Vote database seeding & sheet sync...");

  // 1. Seed Admin Users from ADMIN_EMAILS and Master Admin
  const orgDomain = process.env.ORG_DOMAIN || "@kiot.ac.in";
  const masterEmail = (process.env.MASTER_ADMIN_EMAIL || `2k24cse073${orgDomain.split(",")[0]}`).toLowerCase().trim();
  const rawAdmins = process.env.ADMIN_EMAILS || masterEmail;
  const adminEmails = rawAdmins
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.includes(masterEmail)) {
    adminEmails.push(masterEmail);
  }

  for (const email of adminEmails) {
    const admin = await prisma.user.upsert({
      where: { email },
      update: { role: Role.ADMIN },
      create: {
        email,
        role: Role.ADMIN,
      },
    });
    console.log(`Admin user ready: ${admin.email} (${admin.role})`);
  }

  // 2. Read and Import all Students from Sheets CSV files
  const sheetsDir = path.join(process.cwd(), "Sheets");
  if (fs.existsSync(sheetsDir)) {
    const files = fs
      .readdirSync(sheetsDir)
      .filter((f) => f.endsWith(".csv"))
      .sort();

    console.log(`📂 Processing ${files.length} department CSV sheets...`);

    let importedCount = 0;
    for (const file of files) {
      const fullPath = path.join(sheetsDir, file);
      const content = fs.readFileSync(fullPath, "utf8");
      const parsed = Papa.parse<Record<string, string>>(content, {
        header: true,
        skipEmptyLines: true,
      });

      // Department categorization:
      // CSE, CSBS, AI&DS, IT are CS.
      // Others (ECE, ECX, EEE, Civil, Mech, MCA) are Core (NonCS).
      let category: Category = Category.NonCS;
      const fUpper = file.toUpperCase();
      if (
        fUpper.includes("CSE") ||
        fUpper.includes("CSBS") ||
        fUpper.includes("AI&DS") ||
        fUpper.includes("AIDS") ||
        fUpper.includes("IT")
      ) {
        category = Category.CS;
      }

      for (const row of parsed.data) {
        const studentId = (row["Student ID"] || row["StudentID"] || "").trim();
        const name = (row["Name"] || "").replace(/\s+/g, " ").trim();
        const email = (row["Email"] || "").trim().toLowerCase();
        const gender = (row["Gender"] || "Unspecified").trim();
        const phone = (row["Phone No"] || row["Phone"] || "N/A").trim();
        let year = (row["Year"] || "II Year").trim();
        if (!year || year.toLowerCase() === "not identified") {
          year = "II Year";
        }

        if (!studentId || !name || !email || !email.includes("@")) continue;
        if (name.toLowerCase().includes("count") || email.includes("count")) continue;

        await prisma.participant.upsert({
          where: { studentId },
          update: {
            name,
            email,
            gender: gender || "Unspecified",
            phone: phone || "N/A",
            year,
            category,
          },
          create: {
            studentId,
            name,
            email,
            gender: gender || "Unspecified",
            phone: phone || "N/A",
            year,
            category,
          },
        });
        importedCount++;
      }
    }
    console.log(`✅ Synchronized ${importedCount} participants from department sheets.`);
  }

  // 3. Ensure Active Voting Window (Now -> +7 Days)
  const activeWindow = await prisma.votingWindow.findFirst({
    where: { isActive: true },
  });

  if (!activeWindow) {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await prisma.votingWindow.create({
      data: {
        startsAt: now,
        endsAt: nextWeek,
        isActive: true,
      },
    });
    console.log(`✅ Seeded active voting window until ${nextWeek.toISOString()}`);
  }

  console.log("🚀 Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
