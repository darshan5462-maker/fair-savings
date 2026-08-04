import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

/**
 * Creates default settings, the admin login, and a demo family
 * (Mahadev Mang -> Darshan, Bhavya, Omkar) with one sample loan.
 * Safe to call more than once — every step either upserts or checks
 * for existing data first.
 */
export async function runSeed() {
  const log: string[] = [];

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
  log.push("Settings ready");

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
  log.push(`Admin ready -> username: ${adminUsername} / password: ${adminPassword}`);

  // --- Demo family group ---
  const familyMembers = [
    { username: "KD001", name: "Mahadev Mang" },
    { username: "KD002", name: "Darshan Mang" },
    { username: "KD003", name: "Bhavya Mang" },
    { username: "KD004", name: "Omkar Mang" },
  ];

  const createdIds: Record<string, string> = {};
  const memberPassword = "Member@123";

  for (const m of familyMembers) {
    const member = await prisma.member.upsert({
      where: { username: m.username },
      update: {},
      create: {
        username: m.username,
        passwordHash: await hash(memberPassword),
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
  log.push(`Demo family ready: Mahadev Mang -> Darshan, Bhavya, Omkar (password: ${memberPassword})`);

  // --- Sample loan (only create once, since loans aren't upsertable) ---
  const existingLoan = await prisma.loan.findFirst({ where: { memberId: createdIds["KD002"] } });
  if (!existingLoan) {
    await prisma.loan.create({
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
    log.push("Sample loan created for KD002");
  } else {
    log.push("Sample loan already exists for KD002 (skipped)");
  }

  return log;
}
