import { Router } from "express";
import { body, validationResult } from "express-validator";
import { prisma } from "../config/prisma";
import { comparePassword, signToken } from "../utils/auth";
import { ApiError } from "../middleware/errorHandler";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

/**
 * POST /api/auth/login
 * Single login endpoint for both Admin and Member.
 * Tries Admin table first, then Member table.
 */
router.post(
  "/login",
  [body("username").notEmpty(), body("password").notEmpty()],
  async (req: AuthRequest, res: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new ApiError(400, "Username and password are required");

    const { username, password } = req.body;

    const admin = await prisma.admin.findUnique({ where: { username } });
    if (admin && (await comparePassword(password, admin.passwordHash))) {
      const token = signToken({ id: admin.id, role: "ADMIN", username: admin.username });
      return res.json({
        success: true,
        token,
        user: { id: admin.id, name: admin.name, username: admin.username, role: "ADMIN" },
      });
    }

    const member = await prisma.member.findUnique({ where: { username } });
    if (member && (await comparePassword(password, member.passwordHash))) {
      if (!member.isActive) throw new ApiError(403, "This account has been deactivated");
      const token = signToken({ id: member.id, role: "MEMBER", username: member.username });
      return res.json({
        success: true,
        token,
        user: { id: member.id, name: member.name, username: member.username, role: "MEMBER" },
      });
    }

    throw new ApiError(401, "Invalid username or password");
  }
);

/** GET /api/auth/me - resolve the currently logged-in user from the token */
router.get("/me", authenticate, async (req: AuthRequest, res) => {
  if (req.user!.role === "ADMIN") {
    const admin = await prisma.admin.findUnique({ where: { id: req.user!.id } });
    return res.json({ success: true, user: { ...admin, passwordHash: undefined, role: "ADMIN" } });
  }
  const member = await prisma.member.findUnique({ where: { id: req.user!.id } });
  return res.json({ success: true, user: { ...member, passwordHash: undefined, role: "MEMBER" } });
});

export default router;
