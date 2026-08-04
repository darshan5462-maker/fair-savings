import { Router } from "express";
import { prisma } from "../config/prisma";
import { authenticate, requireRole, requireSelfOrAdmin, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(authenticate);

/** GET /api/notifications/member/:id */
router.get("/member/:id", requireSelfOrAdmin(), async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { memberId: req.params.id },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, data: notifications });
});

/** POST /api/notifications - create a reminder/notification (admin only) */
router.post("/", requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const { memberId, type, title, message } = req.body;
  const notification = await prisma.notification.create({ data: { memberId, type, title, message } });
  res.status(201).json({ success: true, data: notification });
});

/** POST /api/notifications/broadcast - send a reminder to many members at once (admin only) */
router.post("/broadcast", requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const { memberIds, type, title, message } = req.body as { memberIds: string[]; type: string; title: string; message: string };
  const created = await prisma.notification.createMany({
    data: memberIds.map((memberId) => ({ memberId, type: type as any, title, message })),
  });
  res.status(201).json({ success: true, count: created.count });
});

/** PATCH /api/notifications/:id/read */
router.patch("/:id/read", async (req, res) => {
  const notification = await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
  res.json({ success: true, data: notification });
});

export default router;
