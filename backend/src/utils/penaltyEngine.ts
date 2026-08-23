import { prisma } from "../config/prisma";
import { collectionDueDate, loanPaymentDueDate, computePenalty, resolveSavingsStartDate } from "./finance";

/**
 * There's no persistent background worker on this hosting tier (Render free
 * web services sleep between requests, no cron). So instead of a scheduled
 * job, penalties are applied lazily: every time a member's savings schedule
 * or loans are viewed (by the admin or the member themself), we first scan
 * for any week whose due date has already passed with nothing recorded, and
 * apply the 1% penalty right then. From the user's perspective this behaves
 * the same as an automatic Friday-night job - the data is always correct
 * "as of now" the moment anyone looks at it.
 *
 * PERFORMANCE NOTE: the bulk sweeps below fetch Settings ONCE and run every
 * member/loan check concurrently (Promise.all), not one at a time. Doing
 * this sequentially with a fresh Settings query per member turned a 12+
 * member dashboard load into dozens of back-to-back round trips against a
 * serverless Postgres connection - which is exactly what was making the
 * admin dashboard slow to open.
 */

type SettingsRow = {
  collectionDay: string;
  penaltyRate: any;
  savingsStartDate: Date | null;
} | null;

/** Scans one member's weekly savings schedule for overdue unpaid weeks and applies penalties. */
export async function applyMissedSavingsPenalties(memberId: string, settings?: SettingsRow) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: { savings: true, payerRelations: { select: { id: true } } },
  });
  if (!member || !member.savings || member.savings.isSettled) return;

  // A member who is themself a payer for linked children never has
  // individual savings of their own to miss - only their children do.
  // Auto-penalizing the family head for their own "unpaid" week was a bug:
  // that week never existed for them to pay in the first place.
  if (member.payerRelations.length > 0) return;

  const resolvedSettings = settings !== undefined ? settings : await prisma.settings.findFirst();
  const collectionDay = resolvedSettings?.collectionDay ?? "FRIDAY";
  const penaltyRate = Number(resolvedSettings?.penaltyRate ?? 1);
  const savingsStartDate = resolveSavingsStartDate(resolvedSettings?.savingsStartDate);

  const existing = await prisma.weeklyCollection.findMany({ where: { memberId }, select: { weekNumber: true } });
  const existingWeeks = new Set(existing.map((r: { weekNumber: number }) => r.weekNumber));

  // Normalized to midnight so a payment made anytime ON the due date itself
  // is never mistaken for "already overdue" - without this, the moment any
  // time passed midnight on the due date (before anyone even had a chance
  // to collect that day), the week would incorrectly fire as missed.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let penalized = false;

  for (let week = 1; week <= member.savingsCycleWeeks; week++) {
    if (existingWeeks.has(week)) continue;
    const due = collectionDueDate(savingsStartDate, week, collectionDay);
    if (due >= today) break; // not due yet, and every later week is due even later

    // Week 1 is exempt from automatic penalties - the scheme's real start
    // date was corrected after the fact, so nobody should be auto-fined for
    // a due date that only became "already passed" because of that fix.
    if (week === 1) continue;

    const amountDue = Number(member.weeklyAmount);

    await prisma.weeklyCollection.create({
      data: { memberId, weekNumber: week, amountDue, amountPaid: 0, status: "MISSED" },
    });

    const penaltyAmount = computePenalty(amountDue, penaltyRate);
    const penalty = await prisma.penalty.create({
      data: { memberId, reason: `Missed savings - week ${week}`, amount: penaltyAmount },
    });
    penalized = true;

    await prisma.transaction.create({
      data: {
        memberId,
        type: "PENALTY",
        amount: penaltyAmount,
        description: `${penaltyRate}% penalty for missed savings week ${week}`,
        referenceId: penalty.id,
        performedBy: "SYSTEM",
      },
    });
  }

  if (penalized) {
    await prisma.member.update({ where: { id: memberId }, data: { isDefaulter: true } });
  }
}

/** Scans one loan's EMI schedule for overdue unpaid weeks and applies penalties. */
export async function applyMissedLoanPenalties(loanId: string, settings?: SettingsRow) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { payments: { orderBy: { weekNumber: "asc" } } },
  });
  if (!loan) return;
  if (loan.status !== "ACTIVE" && loan.status !== "RENEWED") return;

  const resolvedSettings = settings !== undefined ? settings : await prisma.settings.findFirst();
  const collectionDay = resolvedSettings?.collectionDay ?? "FRIDAY";
  const penaltyRate = Number(resolvedSettings?.penaltyRate ?? 1);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const payment of loan.payments) {
    if (payment.status !== "PENDING") continue;
    const due = loanPaymentDueDate(loan.issueDate, payment.weekNumber, collectionDay);
    if (due >= today) break; // payments are ordered by weekNumber, so later ones aren't due yet either

    await prisma.loanPayment.update({ where: { id: payment.id }, data: { status: "MISSED" } });

    const penaltyAmount = computePenalty(Number(payment.emiDue), penaltyRate);
    const penalty = await prisma.penalty.create({
      data: {
        memberId: loan.memberId,
        loanId: loan.id,
        reason: `Missed EMI - week ${payment.weekNumber}`,
        amount: penaltyAmount,
      },
    });

    await prisma.member.update({ where: { id: loan.memberId }, data: { isDefaulter: true } });

    await prisma.transaction.create({
      data: {
        memberId: loan.memberId,
        type: "PENALTY",
        amount: penaltyAmount,
        description: `${penaltyRate}% penalty for missed EMI week ${payment.weekNumber}`,
        referenceId: penalty.id,
        performedBy: "SYSTEM",
      },
    });
  }
}

/** Runs the loan penalty check across every currently active/renewed loan, concurrently. */
export async function applyMissedLoanPenaltiesForAllLoans() {
  const [settings, activeLoans] = await Promise.all([
    prisma.settings.findFirst(),
    prisma.loan.findMany({ where: { status: { in: ["ACTIVE", "RENEWED"] } }, select: { id: true } }),
  ]);
  await Promise.all(activeLoans.map((loan: { id: string }) => applyMissedLoanPenalties(loan.id, settings)));
}

/** Runs the savings penalty check across every individually-payable member, concurrently (excludes payers-with-children, who have no savings of their own). */
export async function applyMissedSavingsPenaltiesForAllMembers() {
  const [settings, members] = await Promise.all([
    prisma.settings.findFirst(),
    prisma.member.findMany({ where: { isActive: true, payerRelations: { none: {} } }, select: { id: true } }),
  ]);
  await Promise.all(members.map((member: { id: string }) => applyMissedSavingsPenalties(member.id, settings)));
}
