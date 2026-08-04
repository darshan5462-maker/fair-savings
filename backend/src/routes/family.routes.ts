import { Router } from "express";
import { prisma } from "../config/prisma";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate, requireRole("ADMIN")); // only admin can assign/change family links

/** GET /api/family - list all family groups (payer + their children) */
router.get("/", async (_req, res) => {
  const payers = await prisma.member.findMany({
    where: { payerRelations: { some: {} } },
    include: { payerRelations: { include: { child: true } } },
  });
  res.json({ success: true, data: payers });
});

/** GET /api/family/:payerId - children linked to a specific payer */
router.get("/:payerId", async (req, res) => {
  const relations = await prisma.familyRelationship.findMany({
    where: { payerId: req.params.payerId },
    include: { child: true },
  });
  res.json({ success: true, data: relations });
});

/** POST /api/family - link a child to a payer (one child = one payer) */
router.post("/", async (req: AuthRequest, res) => {
  const { payerId, childId } = req.body;
  if (!payerId || !childId) throw new ApiError(400, "payerId and childId are required");
  if (payerId === childId) throw new ApiError(400, "A member cannot be their own payer");

  const existing = await prisma.familyRelationship.findUnique({ where: { childId } });
  if (existing) throw new ApiError(409, "This member is already linked to a payer");

  const relation = await prisma.familyRelationship.create({ data: { payerId, childId } });

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: "LINK_FAMILY", entity: "FamilyRelationship", entityId: relation.id },
  });

  res.status(201).json({ success: true, data: relation });
});

/** DELETE /api/family/:childId - unlink a child from their payer */
router.delete("/:childId", async (req: AuthRequest, res) => {
  await prisma.familyRelationship.delete({ where: { childId: req.params.childId } });
  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: "UNLINK_FAMILY", entity: "FamilyRelationship", entityId: req.params.childId },
  });
  res.json({ success: true, message: "Family link removed" });
});

export default router;
