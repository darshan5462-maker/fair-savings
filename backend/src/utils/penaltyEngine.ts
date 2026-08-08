import { prisma } from "../config/prisma";
import { collectionDueDate, loanPaymentDueDate, computePenalty } from "./finance";

/**
 * There's no persistent background worker on this hosting tier (Render free
 * web services sleep between requests, no cron). So instead of a scheduled
 * job, penalties are applied lazily: every time a member's savings schedule
 * or loans are viewed (by the admin or the member themself), we first scan
 * for any week whose due date has already passed with nothing recorded, and
 * apply the 1% penalty right then. From the user's perspective this behaves
 * the same as an automatic Friday-night job - the data is always correct
 * "as of now" the moment anyone looks at it.
 */

/** Scans one member's weekly savings schedule for overdue unpaid weeks and applies penalties. */
export async function applyMissedSavingsPenalties(memberId: string) {
  const member = await prisma.member.findUnique({ where: { id: memberId }, include: { savings: true } });
  if (!member || !member.savings || member.savings.isSettled) return;

  const settings = await prisma.settings.findFirst();
  const collectionDay = settings?.collectionDay ?? "FRIDAY";
  const penaltyRate = Number(settings?.penaltyRate ?? 1);

  const existing = await prisma.weeklyCollection.findMany({ where: { memberId }, select: { weekNumber: true } });
  const existingWeeks = new Set(existing.map((r: { weekNumber: number }) => r.weekNumber));

  const today = new Date();

  for (let week = 1; week <= member.savingsCycleWeeks; week++) {
    if (existingWeeks.has(week)) continue;
    const due = collectionDueDate(member.joiningDate, week, collectionDay);
    if (due >= today) break; // not due yet, and every later week is due even later

    const amountDue = Number(member.weeklyAmount);

    await prisma.weeklyCollection.create({
      data: { memberId, weekNumber: week, amountDue, amountPaid: 0, status: "MISSED" },
    });

    const penaltyAmount = computePenalty(amountDue, penaltyRate);
    const penalty = await prisma.penalty.create({
      data: { memberId, reason: `Missed savings - week ${week}`, amount: penaltyAmount },
    });

    await prisma.member.update({ where: { id: memberId }, data: { isDefaulter: true } });

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
}

/** Scans one loan's EMI schedule for overdue unpaid weeks and applies penalties. */
export async function applyMissedLoanPenalties(loanId: string) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { payments: { orderBy: { weekNumber: "asc" } } },
  });
  if (!loan) return;
  if (loan.status !== "ACTIVE" && loan.status !== "RENEWED") return;

  const settings = await prisma.settings.findFirst();
  const collectionDay = settings?.collectionDay ?? "FRIDAY";
  const penaltyRate = Number(settings?.penaltyRate ?? 1);

  const today = new Date();

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

/** Runs the loan penalty check across every currently active/renewed loan. Used by admin-wide views. */
export async function applyMissedLoanPenaltiesForAllLoans() {
  const activeLoans = await prisma.loan.findMany({
    where: { status: { in: ["ACTIVE", "RENEWED"] } },
    select: { id: true },
  });
  for (const loan of activeLoans) {
    await applyMissedLoanPenalties(loan.id);
  }
}

/** Runs the savings penalty check across every member. Used by the admin dashboard. */
export async function applyMissedSavingsPenaltiesForAllMembers() {
  const members = await prisma.member.findMany({ where: { isActive: true }, select: { id: true } });
  for (const member of members) {
    await applyMissedSavingsPenalties(member.id);
  }
}
