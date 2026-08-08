import { prisma } from "../config/prisma";
import { computePenalty, collectionDueDate } from "./finance";

/**
 * Checks a loan's pending EMIs against their real due dates and automatically
 * marks any that are overdue as MISSED, applying the 1% penalty - the same
 * effect as the manual "apply-missed-penalty" endpoint, but triggered
 * automatically whenever the loan is viewed instead of requiring an admin
 * to click a button. Idempotent: only ever transitions PENDING -> MISSED,
 * so it's always safe to call on every read.
 */
export async function checkAndApplyMissedLoanPayments(loanId: string) {
  const loan = await prisma.loan.findUnique({ where: { id: loanId }, include: { payments: true } });
  if (!loan) return;
  if (loan.status !== "ACTIVE" && loan.status !== "RENEWED") return;

  const settings = await prisma.settings.findFirst();
  const collectionDay = settings?.collectionDay ?? "FRIDAY";
  const penaltyRate = Number(settings?.penaltyRate ?? 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdue = loan.payments.filter((p: (typeof loan.payments)[number]) => {
    if (p.status !== "PENDING") return false;
    const due = collectionDueDate(loan.issueDate, p.weekNumber, collectionDay);
    return due < today;
  });

  for (const payment of overdue) {
    await prisma.loanPayment.update({ where: { id: payment.id }, data: { status: "MISSED" } });

    const penaltyAmount = computePenalty(Number(payment.emiDue), penaltyRate);
    const penalty = await prisma.penalty.create({
      data: {
        memberId: loan.memberId,
        loanId: loan.id,
        reason: `Missed EMI - week ${payment.weekNumber} (auto-applied)`,
        amount: penaltyAmount,
      },
    });

    await prisma.member.update({ where: { id: loan.memberId }, data: { isDefaulter: true } });

    await prisma.transaction.create({
      data: {
        memberId: loan.memberId,
        type: "PENALTY",
        amount: penaltyAmount,
        description: `1% penalty for missed EMI week ${payment.weekNumber} (auto-applied)`,
        referenceId: penalty.id,
        performedBy: "SYSTEM",
      },
    });
  }
}

/**
 * Same idea for weekly savings: checks a member's upcoming collection weeks
 * against their real due dates, and if a week's due date has passed with
 * nothing paid, creates a MISSED WeeklyCollection row plus a 1% penalty.
 * Only looks a few weeks ahead of the member's current progress, so it never
 * mass-creates rows for the whole 52-week cycle at once.
 */
export async function checkAndApplyMissedSavings(memberId: string) {
  const member = await prisma.member.findUnique({ where: { id: memberId }, include: { savings: true } });
  if (!member || !member.savings || member.savings.isSettled) return;

  const settings = await prisma.settings.findFirst();
  const collectionDay = settings?.collectionDay ?? "FRIDAY";
  const penaltyRate = Number(settings?.penaltyRate ?? 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startWeek = member.savings.weeksCompleted + 1;
  const lookaheadWeeks = 12; // never scan further than this per check
  const endWeek = Math.min(member.savingsCycleWeeks, startWeek + lookaheadWeeks - 1);

  for (let week = startWeek; week <= endWeek; week++) {
    const due = collectionDueDate(member.joiningDate, week, collectionDay);
    if (due >= today) break; // weeks are sequential - once we hit a future one, stop

    const existing = await prisma.weeklyCollection.findUnique({
      where: { memberId_weekNumber: { memberId, weekNumber: week } },
    });
    if (existing) continue; // already paid or already marked missed

    await prisma.weeklyCollection.create({
      data: {
        memberId,
        weekNumber: week,
        amountDue: member.weeklyAmount,
        amountPaid: 0,
        status: "MISSED",
      },
    });

    const penaltyAmount = computePenalty(Number(member.weeklyAmount), penaltyRate);
    const penalty = await prisma.penalty.create({
      data: {
        memberId,
        reason: `Missed weekly savings - week ${week} (auto-applied)`,
        amount: penaltyAmount,
      },
    });

    await prisma.member.update({ where: { id: memberId }, data: { isDefaulter: true } });

    await prisma.transaction.create({
      data: {
        memberId,
        type: "PENALTY",
        amount: penaltyAmount,
        description: `1% penalty for missed week ${week} savings (auto-applied)`,
        referenceId: penalty.id,
        performedBy: "SYSTEM",
      },
    });

    // Note: the missed week's own progress counters (weeksCompleted/weeksRemaining)
    // are only advanced by an actual payment - a MISSED week stays open until paid.
  }
}
