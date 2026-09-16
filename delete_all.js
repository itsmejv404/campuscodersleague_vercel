const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function deleteAll() {
  console.log("⚠️ [delete_all.js] Starting complete database flush...");

  try {
    // Delete in sequence respecting foreign key constraints
    console.log("🗑️ Deleting votes...");
    const deletedVotes = await prisma.vote.deleteMany({});
    console.log(`   Deleted ${deletedVotes.count} votes.`);

    console.log("🗑️ Deleting teams...");
    const deletedTeams = await prisma.team.deleteMany({});
    console.log(`   Deleted ${deletedTeams.count} teams.`);

    console.log("🗑️ Deleting participants...");
    const deletedParticipants = await prisma.participant.deleteMany({});
    console.log(`   Deleted ${deletedParticipants.count} participants.`);

    console.log("🗑️ Deleting OTP tokens...");
    const deletedOtps = await prisma.otpToken.deleteMany({});
    console.log(`   Deleted ${deletedOtps.count} OTP tokens.`);

    console.log("🗑️ Deleting voting windows...");
    const deletedWindows = await prisma.votingWindow.deleteMany({});
    console.log(`   Deleted ${deletedWindows.count} voting windows.`);

    console.log("🗑️ Deleting submission windows...");
    const deletedSubWindows = await prisma.submissionWindow.deleteMany({});
    console.log(`   Deleted ${deletedSubWindows.count} submission windows.`);

    console.log("🗑️ Deleting non-admin users...");
    // Keep ADMIN users so admin login continues to work, or delete all if preferred
    const deletedVoters = await prisma.user.deleteMany({
      where: {
        role: { not: "ADMIN" },
      },
    });
    console.log(`   Deleted ${deletedVoters.count} voter users (Admin accounts preserved).`);

    // Clean up filesystem uploads if directory exists
    try {
      const fs = require("fs");
      const path = require("path");
      const uploadsDir = path.join(process.cwd(), "public", "uploads", "submissions");
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        files.forEach((f) => {
          if (f.endsWith(".pdf")) fs.unlinkSync(path.join(uploadsDir, f));
        });
      }
    } catch {}

    console.log("\n✨ [delete_all.js] All application data successfully flushed!\n");
  } catch (err) {
    console.error("❌ Error flushing database:", err);
    process.exit(1);
  }
}

deleteAll()
  .catch((e) => {
    console.error("❌ Unexpected error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
