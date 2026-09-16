const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");
const { PrismaClient, Role, Category } = require("@prisma/client");

const prisma = new PrismaClient();

async function seed() {
  console.log("🌱 [seed.js] Starting database seeding...");

  // 1. Seed Admin User(s)
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
    console.log(`Admin ready: ${admin.email} (${admin.role})`);
  }

  // 2. Read and import Participants from Sheets folder (supporting data.txt tab-separated and .csv files)
  const sheetsDir = path.join(__dirname, "Sheets");
  if (fs.existsSync(sheetsDir)) {
    const dataTxtPath = path.join(sheetsDir, "data.txt");
    let totalImported = 0;
    let totalSkipped = 0;

    if (fs.existsSync(dataTxtPath)) {
      console.log(`📄 Found ${dataTxtPath}. Parsing participants from data.txt...`);
      const content = fs.readFileSync(dataTxtPath, "utf8");
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

      // Skip header line
      for (const line of lines.slice(1)) {
        const parts = line.split("\t").map((s) => (s || "").trim());
        if (parts.length < 4) {
          totalSkipped++;
          continue;
        }

        const regNo = parts[1] || "";
        const name = (parts[2] || "").replace(/\s+/g, " ").trim();
        const email = (parts[3] || "").toLowerCase().trim();
        const rawContact = parts[4] || "N/A";
        const phone = rawContact.replace(/\s+/g, " ").trim() || "N/A";
        const dept = (parts[5] || "").toUpperCase().trim();

        if (!name || !email || !email.includes("@")) {
          totalSkipped++;
          continue;
        }

        // Standard studentId format: email prefix (e.g. 2K25CSE108)
        const emailPrefix = email.split("@")[0].toUpperCase();
        const studentId = emailPrefix;

        // Determine category
        // CS: CSE, CSBS, AI&DS, AIDS, IT
        // NonCS: ECE, ECX, EEE, CIVIL, MECH, MCA
        let category = Category.NonCS;
        if (
          dept.includes("CSE") ||
          dept.includes("CSBS") ||
          dept.includes("AIDS") ||
          dept.includes("AI&DS") ||
          dept.includes("IT")
        ) {
          category = Category.CS;
        }

        // Determine academic year based on joining batch prefix in email
        let year = "II Year";
        if (email.startsWith("2k25")) {
          year = "I Year";
        } else if (email.startsWith("2k24")) {
          year = "II Year";
        } else if (email.startsWith("2k23")) {
          year = "III Year";
        } else if (email.startsWith("2k22")) {
          year = "IV Year";
        }

        await prisma.participant.upsert({
          where: { studentId },
          update: {
            name,
            email,
            gender: "Unspecified",
            phone,
            year,
            category,
          },
          create: {
            studentId,
            name,
            email,
            gender: "Unspecified",
            phone,
            year,
            category,
          },
        });

        totalImported++;
      }
      console.log(`  ✓ data.txt: Imported/Updated ${totalImported} participants.`);
    }

    // Also support any supplementary CSV files in the folder
    const files = fs
      .readdirSync(sheetsDir)
      .filter((f) => f.toLowerCase().endsWith(".csv"))
      .sort();

    if (files.length > 0) {
      console.log(`📂 Found ${files.length} CSV files in ${sheetsDir}`);

      for (const file of files) {
        const fullPath = path.join(sheetsDir, file);
        const content = fs.readFileSync(fullPath, "utf8");
        const parsed = Papa.parse(content, {
          header: true,
          skipEmptyLines: true,
        });

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
          const email = String(row["Email"] || row["Email Address"] || "").trim().toLowerCase();
          const rawStudentId = String(row["Student ID"] || row["StudentID"] || row["StudentId"] || "").trim();
          const studentId = (email ? email.split("@")[0].toUpperCase() : rawStudentId);
          const name = String(row["Name"] || row["Student Name"] || "").replace(/\s+/g, " ").trim();
          const gender = String(row["Gender"] || row["Sex"] || "Unspecified").trim();
          const phone = String(row["Phone No"] || row["Phone"] || row["Mobile"] || "N/A").trim();
          let year = String(row["Year"] || row["Class"] || "II Year").trim();
          if (!year || year.toLowerCase() === "not identified") {
            year = "II Year";
          }

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
