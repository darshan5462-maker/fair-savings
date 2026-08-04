import { Router } from "express";
import { prisma } from "../config/prisma";
import { authenticate, requireRole } from "../middleware/auth";

const router = Router();
router.use(authenticate);

/** GET /api/settings - anyone logged in can read (needed for currency/theme/language) */
router.get("/", async (_req, res) => {
  let settings = await prisma.settings.findFirst();
  if (!settings) settings = await prisma.settings.create({ data: {} });
  res.json({ success: true, data: settings });
});

/** PUT /api/settings - admin only */
router.put("/", requireRole("ADMIN"), async (req, res) => {
  const existing = await prisma.settings.findFirst();
  const settings = existing
    ? await prisma.settings.update({ where: { id: existing.id }, data: req.body })
    : await prisma.settings.create({ data: req.body });
  res.json({ success: true, data: settings });
});

export default router;
