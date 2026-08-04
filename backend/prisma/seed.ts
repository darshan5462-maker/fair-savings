import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

async function main() {
  console.log("Seeding Fair Savings...");

  // --- Settings ---
  await prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      collectionDay: "FRIDAY",
      loanInterestRate: 10,
      penaltyRate: 1,
      loanDurationWeeks: 11,
      currency: "INR",
      defaultLanguage: "EN",
      defaultTheme: "LIGHT",
    },
  });

  // --- Admin ---
  const adminUsername = process.env.SEED_ADMIN_USERNAME || "admin";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@123";
  await prisma.admin.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      passwordHash: await hash(adminPassword),
      name: "System Administrator",
      email: "admin@fairsavings.app",
    },
  });
  console.log(`Admin ready -> username: ${adminUsername} / password: ${adminPassword}`);

  // --- Demo family group: Mahadev Mang (payer) + 3 children, per the product spec example ---
  const familyMembers = [
    { username: "KD001", name: "Mahadev Mang", isPayer: true },
    { username: "KD002", name: "Darshan Mang" },
    { username: "KD003", name: "Bhavya Mang" },
    { username: "KD004", name: "Omkar Mang" },
  ];

  const createdIds: Record<string, string> = {};

  for (const m of familyMembers) {
    const password = "Member@123";
    const member = await prisma.member.upsert({
      where: { username: m.username },
      update: {},
      create: {
        username: m.username,
        passwordHash: await hash(password),
        name: m.name,
        village: "Sample Village",
        phone: "9000000000",
        weeklyAmount: 500,
        savingsCycleWeeks: 52,
        savings: { create: { weeksRemaining: 52 } },
      },
    });
    createdIds[m.username] = member.id;
  }

  const payerId = createdIds["KD001"];
  for (const childUsername of ["KD002", "KD003", "KD004"]) {
    await prisma.familyRelationship.upsert({
      where: { childId: createdIds[childUsername] },
      update: {},
      create: { payerId, childId: createdIds[childUsername] },
    });
  }
  console.log("Demo family created: Mahadev Mang -> Darshan, Bhavya, Omkar (login password: Member@123)");

  // --- Sample loan for one member ---
  const loan = await prisma.loan.create({
    data: {
      memberId: createdIds["KD002"],
      principalAmount: 10000,
      interestRate: 10,
      durationWeeks: 11,
      totalRepayment: 11000,
      weeklyEmi: 1000,
      remainingAmount: 11000,
      remainingWeeks: 11,
      payments: {
        create: Array.from({ length: 11 }, (_, i) => ({ weekNumber: i + 1, emiDue: 1000 })),
      },
    },
  });
  console.log("Sample loan created for KD002:", loan.id);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
