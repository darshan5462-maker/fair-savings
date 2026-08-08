import { Router } from "express";
import { prisma } from "../config/prisma";
import { authenticate, requireRole, requireSelfOrAdmin } from "../middleware/auth";
import { applyMissedSavingsPenaltiesForAllMembers, applyMissedLoanPenaltiesForAllLoans, applyMissedSavingsPenalties } from "../utils/penaltyEngine";

const router = Router();
router.use(authenticate);

/** GET /api/dashboard/admin - the summary cards + chart series */
router.get("/admin", requireRole("ADMIN"), async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Sweep for any overdue unpaid weeks across the whole system before computing totals,
  // so the numbers shown are always up to date - see utils/penaltyEngine.ts for why this
  // is "on view" rather than a scheduled job.
  await Promise.all([applyMissedSavingsPenaltiesForAllMembers(), applyMissedLoanPenaltiesForAllLoans()]);

  const [
    totalMembers,
    activeLoans,
    defaulters,
    completedMembers,
    todaysCollectionAgg,
    totalSavingsAgg,
    totalLoanAgg,
    totalFinesAgg,
    allLoansForInterest,
    pendingCollections,
  ] = await Promise.all([
    prisma.member.count(),
    prisma.loan.count({ where: { status: { in: ["ACTIVE", "RENEWED"] } } }),
    prisma.member.count({ where: { isDefaulter: true } }),
    prisma.savings.count({ where: { isSettled: true } }),
    prisma.weeklyCollection.aggregate({
      _sum: { amountPaid: true },
      where: { paymentDate: { gte: today } },
    }),
    prisma.savings.aggregate({ _sum: { totalPaid: true } }),
    prisma.loan.aggregate({ _sum: { principalAmount: true } }),
    prisma.penalty.aggregate({ _sum: { amount: true } }),
    prisma.loan.findMany({ select: { principalAmount: true, totalRepayment: true } }),
    prisma.weeklyCollection.count({ where: { status: "PENDING" } }),
  ]);

  // Interest is fixed at issuance (simple interest): totalRepayment - principalAmount,
  // summed across every loan ever issued.
  const totalInterest = allLoansForInterest.reduce(
    (sum: number, l: { principalAmount: any; totalRepayment: any }) => sum + (Number(l.totalRepayment) - Number(l.principalAmount)),
    0
  );

  // Weekly collection trend - last 8 weeks
  const weeklyTrend = await prisma.weeklyCollection.groupBy({
    by: ["weekNumber"],
    _sum: { amountPaid: true },
    orderBy: { weekNumber: "asc" },
    take: 8,
  });

  // Savings growth - cumulative totalPaid by month (last 6 months), derived from transactions
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const savingsTx = await prisma.transaction.findMany({
    where: { type: "SAVINGS_PAYMENT", createdAt: { gte: sixMonthsAgo } },
    select: { amount: true, createdAt: true },
  });
  const savingsByMonth: Record<string, number> = {};
  savingsTx.forEach((t: { amount: any; createdAt: Date }) => {
    const key = `${t.createdAt.getFullYear()}-${String(t.createdAt.getMonth() + 1).padStart(2, "0")}`;
    savingsByMonth[key] = (savingsByMonth[key] || 0) + Number(t.amount);
  });

  const loanStats = await prisma.loan.groupBy({ by: ["status"], _count: { _all: true } });

  res.json({
    success: true,
    data: {
      cards: {
        totalMembers,
        todaysCollection: Number(todaysCollectionAgg._sum.amountPaid ?? 0),
        activeLoans,
        pendingCollections,
        totalSavings: Number(totalSavingsAgg._sum.totalPaid ?? 0),
        totalLoanAmount: Number(totalLoanAgg._sum.principalAmount ?? 0),
        totalInterest: Math.round(totalInterest * 100) / 100,
        totalFines: Number(totalFinesAgg._sum.amount ?? 0),
        defaulters,
        completedMembers,
      },
      charts: {
        weeklyCollection: weeklyTrend.map((w: (typeof weeklyTrend)[number]) => ({ week: w.weekNumber, amount: Number(w._sum.amountPaid ?? 0) })),
        savingsGrowth: Object.entries(savingsByMonth).map(([month, amount]) => ({ month, amount })),
        loanStatistics: loanStats.map((l: (typeof loanStats)[number]) => ({ status: l.status, count: l._count._all })),
      },
    },
  });
});

/** GET /api/dashboard/member/:id - self summary card data */
router.get("/member/:id", requireSelfOrAdmin(), async (req, res) => {
  await applyMissedSavingsPenalties(req.params.id);

  const member = await prisma.member.findUnique({
    where: { id: req.params.id },
    include: {
      savings: true,
      loans: { where: { status: { in: ["ACTIVE", "RENEWED"] } } },
      penalties: { where: { isPaid: false } },
      payerRelations: {
        include: {
          child: {
            include: {
              savings: true,
              loans: { where: { status: { in: ["ACTIVE", "RENEWED"] } } },
              penalties: { where: { isPaid: false } },
            },
          },
        },
      },
    },
  });
  res.json({ success: true, data: member ? { ...member, passwordHash: undefined } : null });
});

export default router;
