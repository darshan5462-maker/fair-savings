import { Router } from "express";
import { prisma } from "../config/prisma";
import { authenticate, requireRole } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

/** GET /api/penalties - List all penalties */
router.get("/", requireRole("ADMIN"), async (req, res) => {
  const penalties = await prisma.penalty.findMany({
    orderBy: { createdAt: "desc" },
    include: { member: { select: { id: true, name: true, username: true } } },
  });
  res.json({ success: true, data: penalties });
});

/** POST /api/penalties - Create a manual penalty */
router.post("/", requireRole("ADMIN"), async (req, res) => {
  const { memberId, reason, amount } = req.body;
  if (!memberId || !reason || amount == null) throw new ApiError(400, "Missing required fields");

  const penalty = await prisma.penalty.create({
    data: { memberId, reason, amount: Number(amount) },
    include: { member: { select: { id: true, name: true, username: true } } },
  });

  await prisma.member.update({ where: { id: memberId }, data: { isDefaulter: true } });

  await prisma.transaction.create({
    data: {
      memberId,
      type: "PENALTY",
      amount: Number(amount),
      description: `Manual penalty: ${reason}`,
      referenceId: penalty.id,
      performedBy: req.user!.id,
    },
  });

  res.status(201).json({ success: true, data: penalty });
});

/** PUT /api/penalties/:id - Edit a penalty */
router.put("/:id", requireRole("ADMIN"), async (req, res) => {
  const { reason, amount, isPaid } = req.body;
  const existing = await prisma.penalty.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, "Penalty not found");

  const updateData: any = {};
  if (reason !== undefined) updateData.reason = reason;
  if (amount !== undefined) updateData.amount = Number(amount);
  
  if (isPaid !== undefined) {
    updateData.isPaid = isPaid;
    if (isPaid && !existing.isPaid) updateData.paidDate = new Date();
    if (!isPaid && existing.isPaid) updateData.paidDate = null;
  }

  const penalty = await prisma.penalty.update({
    where: { id: req.params.id },
    data: updateData,
    include: { member: { select: { id: true, name: true, username: true } } },
  });

  // Re-evaluate defaulter status
  const pendingPenalties = await prisma.penalty.count({ where: { memberId: penalty.memberId, isPaid: false } });
  const missedSavings = await prisma.weeklyCollection.count({ where: { memberId: penalty.memberId, status: "MISSED" } });
  const missedLoan = await prisma.loanPayment.count({ where: { status: "MISSED", loan: { memberId: penalty.memberId } } });
  
  await prisma.member.update({
    where: { id: penalty.memberId },
    data: { isDefaulter: pendingPenalties > 0 || missedSavings > 0 || missedLoan > 0 },
  });

  if (isPaid && !existing.isPaid) {
    await prisma.transaction.create({
      data: {
        memberId: penalty.memberId,
        type: "PENALTY_PAYMENT",
        amount: existing.amount,
        description: `Paid penalty: ${penalty.reason}`,
        referenceId: penalty.id,
        performedBy: req.user!.id,
      },
    });
  }

  res.json({ success: true, data: penalty });
});

/** DELETE /api/penalties/:id - Delete a penalty */
router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const penalty = await prisma.penalty.findUnique({ where: { id: req.params.id } });
  if (!penalty) throw new ApiError(404, "Penalty not found");

  // Delete related transactions
  await prisma.transaction.deleteMany({ where: { referenceId: penalty.id } });

  await prisma.penalty.delete({ where: { id: req.params.id } });

  // Re-evaluate defaulter status
  const pendingPenalties = await prisma.penalty.count({ where: { memberId: penalty.memberId, isPaid: false } });
  const missedSavings = await prisma.weeklyCollection.count({ where: { memberId: penalty.memberId, status: "MISSED" } });
  const missedLoan = await prisma.loanPayment.count({ where: { status: "MISSED", loan: { memberId: penalty.memberId } } });
  
  await prisma.member.update({
    where: { id: penalty.memberId },
    data: { isDefaulter: pendingPenalties > 0 || missedSavings > 0 || missedLoan > 0 },
  });

  res.json({ success: true, data: {} });
});

export default router;
