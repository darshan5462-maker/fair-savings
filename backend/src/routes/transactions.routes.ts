import { Router } from "express";
import { prisma } from "../config/prisma";
import { authenticate, requireRole, requireSelfOrAdmin } from "../middleware/auth";

const router = Router();
router.use(authenticate);

/** GET /api/transactions - full ledger (admin only) */
router.get("/", requireRole("ADMIN"), async (req, res) => {
  const { type } = req.query as Record<string, string>;
  const transactions = await prisma.transaction.findMany({
    where: type ? { type: type as any } : {},
    include: { member: { select: { id: true, name: true, username: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  res.json({ success: true, data: transactions });
});

/** GET /api/transactions/member/:id - a member's own transaction history */
router.get("/member/:id", requireSelfOrAdmin(), async (req, res) => {
  const transactions = await prisma.transaction.findMany({
    where: { memberId: req.params.id },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, data: transactions });
});

// Note: no PUT/DELETE routes are exposed by design — transactions are an
// append-only audit trail. "Nothing should ever be deleted."

export default router;
