import { Router } from "express";
import { prisma } from "../config/prisma";
import { authenticate, requireRole, requireSelfOrAdmin, AuthRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { savingsProgress, collectionDueDate, resolveSavingsStartDate, nextWeekdayOnOrAfter } from "../utils/finance";
import { applyMissedSavingsPenalties } from "../utils/penaltyEngine";

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
 * GET /api/collections/schedule/:id?weeks=8
 * Returns the member's collection schedule: past/paid weeks from the DB,
 * plus computed upcoming due dates for weeks that haven't happened yet.
 * Lets admins (and the member themself) see exactly which Fridays are due.
 */
router.get("/schedule/:id", requireSelfOrAdmin(), async (req, res) => {
  const weeksAhead = Math.min(52, Number(req.query.weeks) || 8);

  await applyMissedSavingsPenalties(req.params.id);

  const member = await prisma.member.findUnique({ where: { id: req.params.id }, include: { savings: true } });
  if (!member) throw new ApiError(404, "Member not found");

  const settings = await prisma.settings.findFirst();
  const collectionDay = settings?.collectionDay ?? "FRIDAY";
  const savingsStartDate = resolveSavingsStartDate(settings?.savingsStartDate);

  const existing = await prisma.weeklyCollection.findMany({
    where: { memberId: member.id },
    orderBy: { weekNumber: "asc" },
  });
  const existingByWeek = new Map<number, any>(existing.map((r: any) => [r.weekNumber, r]));

  const weeksCompleted = member.savings?.weeksCompleted ?? 0;
  const startWeek = weeksCompleted + 1;
  const endWeek = Math.min(member.savingsCycleWeeks, startWeek + weeksAhead - 1);

  interface ScheduleRow {
    weekNumber: number;
    dueDate: Date;
    id: string | null;
    amountDue: number | any;
    amountPaid: number | any;
    status: string;
    paymentDate: Date | null;
  }

  const schedule: ScheduleRow[] = [];
  for (let week = 1; week <= endWeek; week++) {
    const row = existingByWeek.get(week);
    if (row) {
      schedule.push({
        weekNumber: week,
        dueDate: collectionDueDate(savingsStartDate, week, collectionDay),
        id: row.id,
        amountDue: row.amountDue,
        amountPaid: row.amountPaid,
        status: row.status,
        paymentDate: row.paymentDate,
      });
    } else if (week >= startWeek) {
      schedule.push({
        weekNumber: week,
        dueDate: collectionDueDate(savingsStartDate, week, collectionDay),
        id: null,
        amountDue: member.weeklyAmount,
        amountPaid: 0,
        status: "PENDING",
        paymentDate: null,
      });
    }
  }

  res.json({ success: true, data: schedule });
});

/**
 * GET /api/collections/upcoming-dates?weeks=4
 * The next N upcoming collection dates from today, purely calendar-based
 * off the collection day + scheme start date - NOT tied to any single
 * member's personal week-number progress. Useful for a family payer, where
 * each linked child may be at a slightly different week count but the
 * actual Friday collection dates are shared across the whole family.
 */
router.get("/upcoming-dates", async (req, res) => {
  const weeksAhead = Math.min(52, Number(req.query.weeks) || 4);

  const settings = await prisma.settings.findFirst();
  const collectionDay = settings?.collectionDay ?? "FRIDAY";
  const startDate = resolveSavingsStartDate(settings?.savingsStartDate);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let date = nextWeekdayOnOrAfter(startDate, collectionDay);
  while (date < today) {
    date = new Date(date);
    date.setDate(date.getDate() + 7);
  }

  const dates: Date[] = [];
  for (let i = 0; i < weeksAhead; i++) {
    dates.push(new Date(date));
    date = new Date(date);
    date.setDate(date.getDate() + 7);
  }

  res.json({ success: true, data: dates });
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
 * One payer (e.g. father) pays for several linked children in a single screen.
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

/**
 * PATCH /api/collections/:id
 * Admin correction: edit an already-recorded weekly collection (amount,
 * status, date). Recomputes the member's savings totals from the ledger
 * afterward so corrections never drift out of sync.
 */
router.patch("/:id", requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const { amountPaid, status, paymentDate } = req.body;
  const existing = await prisma.weeklyCollection.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, "Collection record not found");

  const updated = await prisma.weeklyCollection.update({
    where: { id: req.params.id },
    data: {
      amountPaid: amountPaid ?? existing.amountPaid,
      status: status ?? existing.status,
      paymentDate: paymentDate ? new Date(paymentDate) : existing.paymentDate,
    },
  });

  await recomputeSavings(existing.memberId);

  await prisma.transaction.create({
    data: {
      memberId: existing.memberId,
      type: "ADMIN_CHANGE",
      amount: Number(updated.amountPaid),
      description: `Correction to week ${updated.weekNumber} savings collection`,
      referenceId: updated.id,
      performedBy: req.user!.id,
    },
  });

  res.json({ success: true, data: updated });
});

/** Shared logic: records a weekly savings payment, then recomputes the member's savings summary. */
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

  await recomputeSavings(memberId);

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

  const savings = await prisma.savings.findUnique({ where: { memberId } });
  return { ...collection, progress: savingsProgress(savings?.weeksCompleted ?? 0, member.savingsCycleWeeks) };
}

/**
 * Recomputes a member's savings summary (totalPaid, weeksCompleted,
 * weeksRemaining, currentBalance) directly from their WeeklyCollection
 * ledger. Called after every payment or admin correction so the summary
 * can never drift out of sync with the underlying records.
 */
async function recomputeSavings(memberId: string) {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return;

  const agg = await prisma.weeklyCollection.aggregate({
    where: { memberId, status: "PAID" },
    _sum: { amountPaid: true },
    _count: { _all: true },
  });

  const weeksCompleted = agg._count._all;
  const totalPaid = Number(agg._sum.amountPaid ?? 0);
  const weeksRemaining = Math.max(0, member.savingsCycleWeeks - weeksCompleted);

  await prisma.savings.update({
    where: { memberId },
    data: { totalPaid, weeksCompleted, weeksRemaining, currentBalance: totalPaid },
  });
}

/** PATCH /api/collections/settle/:memberId - mark 52-week settlement paid (admin only) */
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
