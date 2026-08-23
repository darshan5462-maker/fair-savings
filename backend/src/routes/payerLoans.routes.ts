import { Router } from "express";
import { prisma } from "../config/prisma";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { generateRandomPassword, hashPassword, nextUsernameFromList } from "../utils/auth";

const router = Router();
router.use(authenticate);

/**
 * This feature is deliberately isolated from the Member/Savings/family
 * system. A payer (an existing Member) can lend money either to themself
 * (SELF - just a loan record, no new account of any kind) or to someone
 * outside the savings scheme entirely (OUTSIDE - gets a login-only
 * LoanBorrower account with no savings, no family link, no Member row).
 */

async function assertCanActAsPayer(req: AuthRequest, payerId: string) {
  if (req.user!.role === "ADMIN") return;
  if (req.user!.role === "MEMBER" && req.user!.id === payerId) return;
  throw new ApiError(403, "Access denied");
}

async function loadLoanWithAccessCheck(req: AuthRequest, loanId: string) {
  const loan = await prisma.payerLoan.findUnique({
    where: { id: loanId },
    include: {
      payer: { select: { id: true, name: true, username: true } },
      borrower: { select: { id: true, name: true, username: true, phone: true } },
      payments: { orderBy: { paymentDate: "desc" } },
    },
  });
  if (!loan) throw new ApiError(404, "Loan not found");

  const isOwner =
    req.user!.role === "ADMIN" ||
    (req.user!.role === "MEMBER" && req.user!.id === loan.payerId) ||
    (req.user!.role === "BORROWER" && req.user!.id === loan.borrowerId);
  if (!isOwner) throw new ApiError(403, "Access denied");

  return loan;
}

/** GET /api/payer-loans - every loan across every payer (admin only) - system-wide overview */
router.get("/", requireRole("ADMIN"), async (_req, res) => {
  const loans = await prisma.payerLoan.findMany({
    include: {
      payer: { select: { id: true, name: true, username: true } },
      borrower: { select: { id: true, name: true, username: true, phone: true } },
      payments: { orderBy: { paymentDate: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, data: loans });
});

/** GET /api/payer-loans/payer/:payerId - every loan a payer has given (self or admin) */
router.get("/payer/:payerId", async (req: AuthRequest, res) => {
  await assertCanActAsPayer(req, req.params.payerId);

  const loans = await prisma.payerLoan.findMany({
    where: { payerId: req.params.payerId },
    include: {
      borrower: { select: { id: true, name: true, username: true, phone: true } },
      payments: { orderBy: { paymentDate: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, data: loans });
});

/** GET /api/payer-loans/me - a logged-in borrower's own loan(s) */
router.get("/me", async (req: AuthRequest, res) => {
  if (req.user!.role !== "BORROWER") throw new ApiError(403, "Access denied");

  const loans = await prisma.payerLoan.findMany({
    where: { borrowerId: req.user!.id },
    include: {
      payer: { select: { id: true, name: true, username: true, phone: true } },
      payments: { orderBy: { paymentDate: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, data: loans });
});

/** GET /api/payer-loans/:id - single loan detail (payer, borrower, or admin) */
router.get("/:id", async (req: AuthRequest, res) => {
  const loan = await loadLoanWithAccessCheck(req, req.params.id);
  res.json({ success: true, data: loan });
});

/**
 * POST /api/payer-loans
 * Creates a loan. body: { payerId, borrowerType: "SELF" | "OUTSIDE",
 * principalAmount, borrower?: { name, phone } }
 *
 * SELF: just creates a PayerLoan row against the existing payer. No new
 * account, no savings change, nothing else touched.
 *
 * OUTSIDE: creates a login-only LoanBorrower account (auto-generated
 * username/password, returned once) plus the PayerLoan row linking to it.
 * The outside person never becomes a Member - no savings account, no
 * family link, no access to anything but their own loan.
 */
router.post("/", async (req: AuthRequest, res) => {
  const { payerId, borrowerType, principalAmount, borrower } = req.body;

  if (!payerId || !borrowerType || !principalAmount) {
    throw new ApiError(400, "payerId, borrowerType, and principalAmount are required");
  }
  if (borrowerType !== "SELF" && borrowerType !== "OUTSIDE") {
    throw new ApiError(400, 'borrowerType must be "SELF" or "OUTSIDE"');
  }

  await assertCanActAsPayer(req, payerId);

  const payer = await prisma.member.findUnique({ where: { id: payerId } });
  if (!payer) throw new ApiError(404, "Payer not found");

  const amount = Number(principalAmount);
  if (!(amount > 0)) throw new ApiError(400, "principalAmount must be greater than 0");

  if (borrowerType === "SELF") {
    const loan = await prisma.payerLoan.create({
      data: {
        payerId,
        borrowerType: "SELF",
        principalAmount: amount,
        paidAmount: 0,
        remainingAmount: amount,
      },
    });
    return res.status(201).json({ success: true, data: loan });
  }

  // OUTSIDE
  if (!borrower?.name) throw new ApiError(400, "borrower.name is required for an outside person");

  const existingUsernames = await prisma.loanBorrower.findMany({ select: { username: true } });
  const username = nextUsernameFromList(
    existingUsernames.map((b: { username: string }) => b.username),
    "LB"
  );
  const rawPassword = generateRandomPassword();
  const passwordHash = await hashPassword(rawPassword);

  const newBorrower = await prisma.loanBorrower.create({
    data: { username, passwordHash, name: borrower.name, phone: borrower.phone || null },
  });

  const loan = await prisma.payerLoan.create({
    data: {
      payerId,
      borrowerType: "OUTSIDE",
      borrowerId: newBorrower.id,
      principalAmount: amount,
      paidAmount: 0,
      remainingAmount: amount,
    },
    include: { borrower: { select: { id: true, name: true, username: true, phone: true } } },
  });

  res.status(201).json({
    success: true,
    data: loan,
    credentials: { username, password: rawPassword }, // shown once, same pattern as member creation
  });
});

/**
 * POST /api/payer-loans/:id/pay
 * Records a payment against a loan. Either the payer (recording cash they
 * received) or the borrower themself (if self-recording) or admin can do
 * this. Updates paid/remaining and flips status to COMPLETED at ₹0 left.
 */
router.post("/:id/pay", async (req: AuthRequest, res) => {
  const { amount } = req.body;
  const paid = Number(amount);
  if (!(paid > 0)) throw new ApiError(400, "amount must be greater than 0");

  const loan = await loadLoanWithAccessCheck(req, req.params.id);
  if (loan.status === "COMPLETED") throw new ApiError(400, "This loan is already completed");

  const newPaidAmount = Math.round((Number(loan.paidAmount) + paid) * 100) / 100;
  const newRemaining = Math.max(0, Math.round((Number(loan.principalAmount) - newPaidAmount) * 100) / 100);

  const updated = await prisma.payerLoan.update({
    where: { id: loan.id },
    data: {
      paidAmount: newPaidAmount,
      remainingAmount: newRemaining,
      status: newRemaining <= 0 ? "COMPLETED" : "ACTIVE",
    },
  });

  await prisma.payerLoanPayment.create({
    data: {
      loanId: loan.id,
      amount: paid,
      recordedBy: req.user!.role,
    },
  });

  res.json({ success: true, data: updated });
});

export default router;
