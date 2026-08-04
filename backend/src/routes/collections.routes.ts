import { Router } from "express";
import { prisma } from "../config/prisma";
import { authenticate, requireRole, requireSelfOrAdmin, AuthRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { savingsProgress } from "../utils/finance";

const router = Router();
router.use(authenticate);

/** GET /api/collections/member/:id - a member's weekly collection history */
router.get("/member/:id", requireSelfOrAdmin(), async (req, res) => {
  const rows = await prisma.weeklyCollection.findMany({
    where: { memberId: req.params.id },
    orderBy: { weekNumber: "asc" },
  });
  res.json({ success: true, data: rows });
});

/**
 * POST /api/collections/pay-single
 * Records one week's savings payment for a single member (admin only).
 */
router.post("/pay-single", requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const { memberId, amount } = req.body;
  const record = await recordWeeklyPayment(memberId, amount, req.user!.id, memberId);
  res.status(201).json({ success: true, data: record });
});

/**
 * POST /api/collections/pay-family
 * KEY FEATURE: one payer (e.g. father) pays for several linked children in a single screen.
 * body: { payerId, payments: [{ memberId, amount }, ...] }
 */
router.post("/pay-family", requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const { payerId, payments } = req.body as { payerId: string; payments: { memberId: string; amount: number }[] };
  if (!Array.isArray(payments) || payments.length === 0) {
    throw new ApiError(400, "payments array is required");
  }

  const results = [];
  let total = 0;
  for (const p of payments) {
    const record = await recordWeeklyPayment(p.memberId, p.amount, req.user!.id, payerId);
    results.push(record);
    total += p.amount;
  }

  res.status(201).json({ success: true, totalCollected: total, data: results });
});

/** Shared logic: records a weekly savings payment and updates the member's Savings summary. */
async function recordWeeklyPayment(memberId: string, amount: number, adminId: string, collectedBy: string) {
  const member = await prisma.member.findUnique({ where: { id: memberId }, include: { savings: true } });
  if (!member) throw new ApiError(404, `Member ${memberId} not found`);
  if (!member.savings) throw new ApiError(400, `Member ${memberId} has no savings account`);

  const weekNumber = member.savings.weeksCompleted + 1;

  const collection = await prisma.weeklyCollection.upsert({
    where: { memberId_weekNumber: { memberId, weekNumber } },
    update: { amountPaid: amount, status: "PAID", collectedBy, paymentDate: new Date() },
    create: {
      memberId,
      weekNumber,
      amountDue: member.weeklyAmount,
      amountPaid: amount,
      status: "PAID",
      collectedBy,
      paymentDate: new Date(),
    },
  });

  const weeksCompleted = member.savings.weeksCompleted + 1;
  const weeksRemaining = Math.max(0, member.savingsCycleWeeks - weeksCompleted);
  const totalPaid = Number(member.savings.totalPaid) + Number(amount);

  await prisma.savings.update({
    where: { memberId },
    data: {
      totalPaid,
      weeksCompleted,
      weeksRemaining,
      currentBalance: totalPaid,
    },
  });

  await prisma.transaction.create({
    data: {
      memberId,
      type: "SAVINGS_PAYMENT",
      amount,
      description: `Week ${weekNumber} savings payment`,
      referenceId: collection.id,
      performedBy: adminId,
    },
  });

  return { ...collection, progress: savingsProgress(weeksCompleted, member.savingsCycleWeeks) };
}

/** PATCH /api/collections/:id/settle - mark 52-week settlement paid (admin only) */
router.patch("/settle/:memberId", requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const { settlementAmount } = req.body;
  const savings = await prisma.savings.update({
    where: { memberId: req.params.memberId },
    data: { isSettled: true, settlementDate: new Date(), settlementAmount },
  });

  await prisma.transaction.create({
    data: {
      memberId: req.params.memberId,
      type: "SETTLEMENT",
      amount: settlementAmount,
      description: "52-week savings cycle settlement",
      performedBy: req.user!.id,
    },
  });

  res.json({ success: true, data: savings });
});

export default router;
