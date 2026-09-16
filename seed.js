const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");
const { PrismaClient, Role, Category } = require("@prisma/client");

const prisma = new PrismaClient();

async function seed() {
  console.log("🌱 [seed.js] Starting database seeding...");

  // 1. Seed Admin User(s)
  const orgDomain = process.env.ORG_DOMAIN || "@kiot.ac.in";
  const defaultAdmin = `2k24cse073${orgDomain.split(",")[0]}`;
  const rawAdmins = process.env.ADMIN_EMAILS || defaultAdmin;
  const adminEmails = rawAdmins
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  for (const email of adminEmails) {
    const admin = await prisma.user.upsert({
      where: { email },
      update: { role: Role.ADMIN },
      create: {
        email,
        role: Role.ADMIN,
      },
    });
    console.log(`👤 Admin ready: ${admin.email} (${admin.role})`);
  }

  // 2. Read all CSV files in Sheets directory and upsert Participants
  const sheetsDir = path.join(__dirname, "Sheets");
  if (fs.existsSync(sheetsDir)) {
    const files = fs
      .readdirSync(sheetsDir)
      .filter((f) => f.toLowerCase().endsWith(".csv"))
      .sort();

    console.log(`📂 Found ${files.length} CSV files in ${sheetsDir}`);

    let totalImported = 0;
    let totalSkipped = 0;

    for (const file of files) {
      const fullPath = path.join(sheetsDir, file);
      const content = fs.readFileSync(fullPath, "utf8");
      const parsed = Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
      });

      // Infer Category based on sheet name
      // CSE, CSBS, AI&DS, IT => CS
      // ECE, ECX, EEE, Civil, Mech, MCA => NonCS
      let category = Category.NonCS;
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

      let fileImported = 0;
      for (const row of parsed.data) {
        const studentId = String(row["Student ID"] || row["StudentID"] || row["StudentId"] || "").trim();
        const name = String(row["Name"] || row["Student Name"] || "").replace(/\s+/g, " ").trim();
        const email = String(row["Email"] || row["Email Address"] || "").trim().toLowerCase();
        const gender = String(row["Gender"] || row["Sex"] || "Unspecified").trim();
        const phone = String(row["Phone No"] || row["Phone"] || row["Mobile"] || "N/A").trim();
        let year = String(row["Year"] || row["Class"] || "II Year").trim();
        if (!year || year.toLowerCase() === "not identified") {
          year = "II Year";
        }

        // Check if row is a summary or empty
        if (!studentId || !name || !email || !email.includes("@")) {
          totalSkipped++;
          continue;
        }

        if (
          name.toLowerCase().includes("count") ||
          studentId.toLowerCase().includes("count") ||
          email.includes("count")
        ) {
          totalSkipped++;
          continue;
        }

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

        fileImported++;
        totalImported++;
      }

      console.log(`  ✓ ${file}: Imported/Updated ${fileImported} participants (${category})`);
    }

    console.log(`\n🎉 Finished sheet import: ${totalImported} total participants seeded (Skipped ${totalSkipped} invalid/summary rows).`);
  } else {
    console.warn(`⚠️ Warning: Sheets directory not found at ${sheetsDir}`);
  }

  // 3. Ensure an active Voting Window exists
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
    console.log(`⏰ Active voting window initialized (Ends: ${nextWeek.toISOString()})`);
  }

  console.log("✅ [seed.js] Seeding process completed successfully!\n");
}

seed()
  .catch((e) => {
    console.error("❌ Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
