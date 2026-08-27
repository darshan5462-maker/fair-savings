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
 *
 * ACCESS MODEL: only the admin creates loans, records payments, deletes
 * loans, and resets a borrower's password. A payer (MEMBER role) can only
 * VIEW their own loan-giving data - no create/pay/delete actions. An
 * outside borrower (BORROWER role) can view AND pay their own loan, since
 * that's the whole point of their login.
 */

async function assertCanView(req: AuthRequest, payerId: string) {
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

  const canView =
    req.user!.role === "ADMIN" ||
    (req.user!.role === "MEMBER" && req.user!.id === loan.payerId) ||
    (req.user!.role === "BORROWER" && req.user!.id === loan.borrowerId);
  if (!canView) throw new ApiError(403, "Access denied");

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

/** GET /api/payer-loans/payer/:payerId - every loan a payer has given (read-only for the payer themself, or admin) */
router.get("/payer/:payerId", async (req: AuthRequest, res) => {
  await assertCanView(req, req.params.payerId);

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

/** GET /api/payer-loans/:id - single loan detail (payer view-only, borrower, or admin) */
router.get("/:id", async (req: AuthRequest, res) => {
  const loan = await loadLoanWithAccessCheck(req, req.params.id);
  res.json({ success: true, data: loan });
});

/**
 * POST /api/payer-loans (admin only)
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
router.post("/", requireRole("ADMIN"), async (req: AuthRequest, res) => {
  const { payerId, borrowerType, principalAmount, borrower } = req.body;

  if (!payerId || !borrowerType || !principalAmount) {
    throw new ApiError(400, "payerId, borrowerType, and principalAmount are required");
  }
  if (borrowerType !== "SELF" && borrowerType !== "OUTSIDE") {
    throw new ApiError(400, 'borrowerType must be "SELF" or "OUTSIDE"');
  }

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
 * Records a payment. Admin can always do this; a borrower can record their
 * own payment. A payer (MEMBER) cannot - they can only view.
 */
router.post("/:id/pay", async (req: AuthRequest, res) => {
  if (req.user!.role === "MEMBER") {
    throw new ApiError(403, "Only the admin or the borrower can record a payment on this loan");
  }

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

/**
 * DELETE /api/payer-loans/:id (admin only)
 * Removes the loan and its payment history. If the loan was to an outside
 * borrower and that was their only loan, their login is removed too -
 * there's no reason to leave a dangling login with nothing to view.
 */
router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const loan = await prisma.payerLoan.findUnique({ where: { id: req.params.id } });
  if (!loan) throw new ApiError(404, "Loan not found");

  await prisma.payerLoanPayment.deleteMany({ where: { loanId: loan.id } });
  await prisma.payerLoan.delete({ where: { id: loan.id } });

  if (loan.borrowerId) {
    const remaining = await prisma.payerLoan.count({ where: { borrowerId: loan.borrowerId } });
    if (remaining === 0) {
      await prisma.loanBorrower.delete({ where: { id: loan.borrowerId } });
    }
  }

  res.json({ success: true, message: "Loan deleted" });
});

/**
 * POST /api/payer-loans/:id/reset-borrower-password (admin only)
 * Regenerates the login password for an outside borrower and returns it
 * once - the only way to recover access if the original credentials are
 * lost, since passwords are hashed and can't be shown again otherwise.
 */
router.post("/:id/reset-borrower-password", requireRole("ADMIN"), async (req, res) => {
  const loan = await prisma.payerLoan.findUnique({ where: { id: req.params.id } });
  if (!loan) throw new ApiError(404, "Loan not found");
  if (!loan.borrowerId) throw new ApiError(400, "This loan has no outside borrower login to reset");

  const rawPassword = generateRandomPassword();
  const passwordHash = await hashPassword(rawPassword);
  const borrower = await prisma.loanBorrower.update({ where: { id: loan.borrowerId }, data: { passwordHash } });

  res.json({ success: true, credentials: { username: borrower.username, password: rawPassword } });
});

export default router;
