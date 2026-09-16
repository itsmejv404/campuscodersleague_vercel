const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  const total = await prisma.participant.count();
  const cs = await prisma.participant.count({ where: { category: "CS" } });
  const nonCs = await prisma.participant.count({ where: { category: "NonCS" } });
  const teams = await prisma.team.count();
  const votes = await prisma.vote.count();
  const admins = await prisma.user.count({ where: { role: "ADMIN" } });
  const votingWindows = await prisma.votingWindow.count({ where: { isActive: true } });

  console.log("Database Status Summary:");
  console.log("------------------------");
  console.log("Total Participants :", total);
  console.log("CS Participants    :", cs);
  console.log("NonCS Participants :", nonCs);
  console.log("Teams              :", teams);
  console.log("Votes              :", votes);
  console.log("Active Admins      :", admins);
  console.log("Active Windows     :", votingWindows);

  const sample = await prisma.participant.findMany({ take: 4 });
  console.log("\nSample Participants:");
  console.log(JSON.stringify(sample, null, 2));
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
