import { Router } from "express";
import { body, validationResult } from "express-validator";
import QRCode from "qrcode";
import { prisma } from "../config/prisma";
import { authenticate, requireRole, requireSelfOrAdmin, AuthRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { generateRandomPassword, hashPassword, nextUsernameFromList } from "../utils/auth";

const router = Router();
router.use(authenticate);

/** GET /api/members - list + search (admin only) */
router.get("/", requireRole("ADMIN"), async (req, res) => {
  const { search, village, status } = req.query as Record<string, string>;

  const members = await prisma.member.findMany({
    where: {
      AND: [
        search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { username: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
              ],
            }
          : {},
        village ? { village: { equals: village, mode: "insensitive" } } : {},
        status === "active" ? { isActive: true } : {},
        status === "inactive" ? { isActive: false } : {},
        status === "defaulter" ? { isDefaulter: true } : {},
      ],
    },
    include: {
      savings: true,
      childRelation: { include: { payer: true } },
      payerRelations: { include: { child: { include: { savings: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({ success: true, data: members });
});

/** GET /api/members/:id - single member (admin or the member themself) */
router.get("/:id", requireSelfOrAdmin(), async (req, res) => {
  const member = await prisma.member.findUnique({
    where: { id: req.params.id },
    include: {
      savings: true,
      childRelation: { include: { payer: true } },
      payerRelations: { include: { child: true } },
      loans: true,
    },
  });
  if (!member) throw new ApiError(404, "Member not found");
  res.json({ success: true, data: { ...member, passwordHash: undefined } });
});

/** POST /api/members - create member, auto-generate username/password (admin only) */
router.post(
  "/",
  requireRole("ADMIN"),
  [body("name").notEmpty(), body("weeklyAmount").optional().isNumeric()],
  async (req: AuthRequest, res: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg);

    const { name, phone, address, village, aadhaarNumber, nominee, weeklyAmount, savingsCycleWeeks, payerId } =
      req.body;

    const rawPassword = generateRandomPassword();
    const passwordHash = await hashPassword(rawPassword);

    // Retry a few times in case of a genuine race between two concurrent
    // requests both computing the same "next" username at once.
    let member;
    let username = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await prisma.member.findMany({ select: { username: true } });
      username = nextUsernameFromList(existing.map((m: { username: string }) => m.username));
      try {
        member = await prisma.member.create({
          data: {
            username,
            passwordHash,
            name,
            phone,
            address,
            village,
            aadhaarNumber,
            nominee,
            weeklyAmount: weeklyAmount ?? 500,
            savingsCycleWeeks: savingsCycleWeeks ?? 52,
            savings: {
              create: { weeksRemaining: savingsCycleWeeks ?? 52 },
            },
          },
        });
        break;
      } catch (err: any) {
        if (err.code === "P2002" && attempt < 4) continue; // username taken, retry with a fresh scan
        throw err;
      }
    }
    if (!member) throw new ApiError(500, "Could not generate a unique username, please try again");

    if (payerId) {
      await prisma.familyRelationship.create({ data: { payerId, childId: member.id } });
    }

    await prisma.auditLog.create({
      data: { adminId: req.user!.id, action: "CREATE_MEMBER", entity: "Member", entityId: member.id },
    });

    res.status(201).json({
      success: true,
      data: { ...member, passwordHash: undefined },
      credentials: { username, password: rawPassword }, // shown once to admin
    });
  }
);

/** PUT /api/members/:id - edit member (admin only) */
router.put("/:id", requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const {
    name,
    username,
    password,
    phone,
    address,
    village,
    aadhaarNumber,
    nominee,
    weeklyAmount,
    savingsCycleWeeks,
    photoUrl,
  } = req.body;

  if (username) {
    const existing = await prisma.member.findUnique({ where: { username } });
    if (existing && existing.id !== req.params.id) {
      throw new ApiError(409, `Username "${username}" is already taken`);
    }
  }

  const data: Record<string, any> = {
    name,
    phone,
    address,
    village,
    aadhaarNumber,
    nominee,
    weeklyAmount,
    savingsCycleWeeks,
    photoUrl,
  };
  if (username) data.username = username;
  if (password) data.passwordHash = await hashPassword(password);

  const member = await prisma.member.update({ where: { id: req.params.id }, data });

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: "UPDATE_MEMBER", entity: "Member", entityId: member.id },
  });

  res.json({ success: true, data: { ...member, passwordHash: undefined } });
});

/** PATCH /api/members/:id/deactivate */
router.patch("/:id/deactivate", requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const member = await prisma.member.update({ where: { id: req.params.id }, data: { isActive: false } });
  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: "DEACTIVATE_MEMBER", entity: "Member", entityId: member.id },
  });
  res.json({ success: true, data: { ...member, passwordHash: undefined } });
});

/** PATCH /api/members/:id/activate */
router.patch("/:id/activate", requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const member = await prisma.member.update({ where: { id: req.params.id }, data: { isActive: true } });
  res.json({ success: true, data: { ...member, passwordHash: undefined } });
});

/** POST /api/members/:id/reset-password (admin only) */
router.post("/:id/reset-password", requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const rawPassword = generateRandomPassword();
  const passwordHash = await hashPassword(rawPassword);
  const member = await prisma.member.update({ where: { id: req.params.id }, data: { passwordHash } });

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: "RESET_PASSWORD", entity: "Member", entityId: member.id },
  });

  res.json({ success: true, credentials: { username: member.username, password: rawPassword } });
});

/** DELETE /api/members/:id (admin only) - cascades through all related records */
router.delete("/:id", requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const memberId = req.params.id;
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) throw new ApiError(404, "Member not found");

  const loans = await prisma.loan.findMany({ where: { memberId }, select: { id: true } });
  const loanIds = loans.map((l: (typeof loans)[number]) => l.id);

  await prisma.$transaction([
    prisma.loanPayment.deleteMany({ where: { loanId: { in: loanIds } } }),
    prisma.penalty.deleteMany({ where: { memberId } }),
    prisma.loan.deleteMany({ where: { memberId } }),
    prisma.weeklyCollection.deleteMany({ where: { memberId } }),
    prisma.transaction.deleteMany({ where: { memberId } }),
    prisma.notification.deleteMany({ where: { memberId } }),
    prisma.familyRelationship.deleteMany({ where: { OR: [{ payerId: memberId }, { childId: memberId }] } }),
    prisma.savings.deleteMany({ where: { memberId } }),
    prisma.member.delete({ where: { id: memberId } }),
  ]);

  await prisma.auditLog.create({
    data: { adminId: req.user!.id, action: "DELETE_MEMBER", entity: "Member", entityId: memberId },
  });
  res.json({ success: true, message: "Member deleted" });
});

/** POST /api/members/:id/qr-card - generate a QR code encoding the member id/username */
router.post("/:id/qr-card", requireRole("ADMIN"), async (req, res) => {
  const member = await prisma.member.findUnique({ where: { id: req.params.id } });
  if (!member) throw new ApiError(404, "Member not found");

  const qrDataUrl = await QRCode.toDataURL(
    JSON.stringify({ id: member.id, username: member.username, name: member.name })
  );
  const updated = await prisma.member.update({ where: { id: member.id }, data: { qrCode: qrDataUrl } });
  res.json({ success: true, qrCode: updated.qrCode });
});

export default router;
