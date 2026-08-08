import { Router } from "express";
import { prisma } from "../config/prisma";
import { authenticate, requireRole, requireSelfOrAdmin, AuthRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { computeLoan, computePenalty, computeRenewal, round2, loanPaymentDueDate } from "../utils/finance";
import { applyMissedLoanPenaltiesForAllLoans, applyMissedLoanPenalties } from "../utils/penaltyEngine";

const router = Router();
router.use(authenticate);

/** Adds a computed real-world dueDate to each payment, based on the loan's issue date and the collection day setting. */
async function withPaymentDueDates<T extends { payments: { weekNumber: number }[] }>(loan: T): Promise<T> {
  const settings = await prisma.settings.findFirst();
  const collectionDay = settings?.collectionDay ?? "FRIDAY";
  const issueDate = (loan as any).issueDate as Date;
  return {
    ...loan,
    payments: loan.payments.map((p) => ({ ...p, dueDate: loanPaymentDueDate(issueDate, p.weekNumber, collectionDay) })),
  };
}

/** GET /api/loans - all loans (admin only), filterable by status */
router.get("/", requireRole("ADMIN"), async (req, res) => {
  const { status } = req.query as Record<string, string>;

  await applyMissedLoanPenaltiesForAllLoans();

  const loans = await prisma.loan.findMany({
    where: status ? { status: status as any } : {},
    include: { member: { select: { id: true, name: true, username: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, data: loans });
});

/** GET /api/loans/member/:id - a member's loans (self or admin) */
router.get("/member/:id", requireSelfOrAdmin(), async (req, res) => {
  const existingLoans = await prisma.loan.findMany({
    where: { memberId: req.params.id, status: { in: ["ACTIVE", "RENEWED"] } },
    select: { id: true },
  });
  for (const loan of existingLoans) {
    await applyMissedLoanPenalties(loan.id);
  }

  const loans = await prisma.loan.findMany({
    where: { memberId: req.params.id },
    include: { payments: { orderBy: { weekNumber: "asc" } }, penalties: true },
    orderBy: { createdAt: "desc" },
  });
  const withDates = await Promise.all(loans.map(withPaymentDueDates));
  res.json({ success: true, data: withDates });
});

/** GET /api/loans/:id - a single loan with its full EMI payment history (self or admin) */
router.get("/:id", async (req: AuthRequest, res) => {
  await applyMissedLoanPenalties(req.params.id);

  const loan = await prisma.loan.findUnique({
    where: { id: req.params.id },
    include: {
      payments: { orderBy: { weekNumber: "asc" } },
      penalties: { orderBy: { createdAt: "asc" } },
      member: { select: { id: true, name: true, username: true } },
    },
  });
  if (!loan) throw new ApiError(404, "Loan not found");
  if (req.user!.role !== "ADMIN" && req.user!.id !== loan.memberId) {
    throw new ApiError(403, "Access denied");
  }
  const withDates = await withPaymentDueDates(loan);
  res.json({ success: true, data: withDates });
});

/** POST /api/loans - issue a new loan (admin only, payer/standalone members only) */
router.post("/", requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const { memberId, principalAmount, interestRate, durationWeeks } = req.body;
  if (!memberId || !principalAmount) throw new ApiError(400, "memberId and principalAmount are required");

  const member = await prisma.member.findUnique({ where: { id: memberId }, include: { childRelation: true } });
  if (!member) throw new ApiError(404, "Member not found");
  if (member.childRelation) {
    throw new ApiError(400, "Loans can only be issued to a family payer, not to a linked child member");
  }

  const settings = await prisma.settings.findFirst();
  const rate = interestRate ?? Number(settings?.loanInterestRate ?? 10);
  const duration = durationWeeks ?? settings?.loanDurationWeeks ?? 11;

  const computed = computeLoan({ principalAmount: Number(principalAmount), interestRate: rate, durationWeeks: duration });

  const loan = await prisma.loan.create({
    data: {
      memberId,
      principalAmount,
      interestRate: rate,
      durationWeeks: duration,
      totalRepayment: computed.totalRepayment,
      weeklyEmi: computed.weeklyEmi,
      remainingAmount: computed.remainingAmount,
      remainingWeeks: computed.remainingWeeks,
      dueDate: new Date(Date.now() + duration * 7 * 24 * 60 * 60 * 1000),
      payments: {
        create: Array.from({ length: duration }, (_, i) => ({
          weekNumber: i + 1,
          emiDue: computed.weeklyEmi,
        })),
      },
    },
    include: { payments: true },
  });

  await prisma.transaction.create({
    data: {
      memberId,
      type: "LOAN_ISSUE",
      amount: principalAmount,
      description: `Loan issued: ₹${principalAmount} @ ${rate}% for ${duration} weeks`,
      referenceId: loan.id,
      performedBy: req.user!.id,
    },
  });

  res.status(201).json({ success: true, data: loan });
});

/** POST /api/loans/:id/pay-emi - record a weekly EMI payment (admin only) */
router.post("/:id/pay-emi", requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const { amount } = req.body;
  const loan = await prisma.loan.findUnique({ where: { id: req.params.id }, include: { payments: true } });
  if (!loan) throw new ApiError(404, "Loan not found");

  const nextPayment = loan.payments.find(
    (p: (typeof loan.payments)[number]) => p.status === "PENDING" || p.status === "MISSED"
  );
  if (!nextPayment) throw new ApiError(400, "No pending EMI for this loan");

  const paid = Number(amount);
  const status = paid >= Number(nextPayment.emiDue) ? "PAID" : "PARTIAL";

  await prisma.loanPayment.update({
    where: { id: nextPayment.id },
    data: { amountPaid: paid, status, paymentDate: new Date() },
  });

  const newPaidAmount = round2(Number(loan.paidAmount) + paid);
  const newRemaining = round2(Number(loan.totalRepayment) - newPaidAmount);
  const newRemainingWeeks = Math.max(0, loan.remainingWeeks - 1);

  const updatedLoan = await prisma.loan.update({
    where: { id: loan.id },
    data: {
      paidAmount: newPaidAmount,
      remainingAmount: Math.max(0, newRemaining),
      remainingWeeks: newRemainingWeeks,
      status: newRemaining <= 0 ? "COMPLETED" : loan.status,
    },
  });

  await prisma.transaction.create({
    data: {
      memberId: loan.memberId,
      type: "LOAN_PAYMENT",
      amount: paid,
      description: `EMI week ${nextPayment.weekNumber} payment`,
      referenceId: loan.id,
      performedBy: req.user!.id,
    },
  });

  res.json({ success: true, data: updatedLoan });
});

/**
 * POST /api/loans/:id/apply-missed-penalty
 * Marks the current pending EMI as MISSED and applies a 1% penalty (admin only,
 * or called by a scheduled job — see README for cron setup).
 */
router.post("/:id/apply-missed-penalty", requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const loan = await prisma.loan.findUnique({ where: { id: req.params.id }, include: { payments: true } });
  if (!loan) throw new ApiError(404, "Loan not found");

  const settings = await prisma.settings.findFirst();
  const penaltyRate = Number(settings?.penaltyRate ?? 1);

  const overdue = loan.payments.find((p: (typeof loan.payments)[number]) => p.status === "PENDING");
  if (!overdue) throw new ApiError(400, "No pending EMI to mark as missed");

  await prisma.loanPayment.update({ where: { id: overdue.id }, data: { status: "MISSED" } });

  const penaltyAmount = computePenalty(Number(overdue.emiDue), penaltyRate);

  const penalty = await prisma.penalty.create({
    data: {
      memberId: loan.memberId,
      loanId: loan.id,
      reason: `Missed EMI - week ${overdue.weekNumber}`,
      amount: penaltyAmount,
    },
  });

  await prisma.member.update({ where: { id: loan.memberId }, data: { isDefaulter: true } });

  await prisma.transaction.create({
    data: {
      memberId: loan.memberId,
      type: "PENALTY",
      amount: penaltyAmount,
      description: `1% penalty for missed EMI week ${overdue.weekNumber}`,
      referenceId: penalty.id,
      performedBy: req.user!.id,
    },
  });

  res.json({ success: true, data: penalty });
});

/**
 * POST /api/loans/:id/renew
 * If a loan's duration has elapsed with an outstanding balance, renew it:
 * apply fresh interest on the remaining amount and restart the EMI schedule.
 */
router.post("/:id/renew", requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const loan = await prisma.loan.findUnique({ where: { id: req.params.id } });
  if (!loan) throw new ApiError(404, "Loan not found");
  if (Number(loan.remainingAmount) <= 0) throw new ApiError(400, "Loan is already fully paid");

  const settings = await prisma.settings.findFirst();
  const rate = Number(settings?.loanInterestRate ?? 10);
  const duration = settings?.loanDurationWeeks ?? 11;

  const computed = computeRenewal(Number(loan.remainingAmount), rate, duration);

  await prisma.loan.update({ where: { id: loan.id }, data: { status: "RENEWED" } });

  const renewedLoan = await prisma.loan.create({
    data: {
      memberId: loan.memberId,
      principalAmount: loan.remainingAmount,
      interestRate: rate,
      durationWeeks: duration,
      totalRepayment: computed.totalRepayment,
      weeklyEmi: computed.weeklyEmi,
      remainingAmount: computed.remainingAmount,
      remainingWeeks: computed.remainingWeeks,
      parentLoanId: loan.id,
      renewalCount: loan.renewalCount + 1,
      dueDate: new Date(Date.now() + duration * 7 * 24 * 60 * 60 * 1000),
      payments: {
        create: Array.from({ length: duration }, (_, i) => ({
          weekNumber: i + 1,
          emiDue: computed.weeklyEmi,
        })),
      },
    },
  });

  res.status(201).json({ success: true, data: renewedLoan });
});

export default router;
