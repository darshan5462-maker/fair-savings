import { Router } from "express";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { prisma } from "../config/prisma";
import { authenticate, requireRole, requireSelfOrAdmin, AuthRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);

/** GET /api/reports/member/:id/statement.pdf - member statement (self or admin) */
router.get("/member/:id/statement.pdf", requireSelfOrAdmin(), async (req, res) => {
  const member = await prisma.member.findUnique({
    where: { id: req.params.id },
    include: { savings: true, loans: true, transactions: { orderBy: { createdAt: "desc" }, take: 100 } },
  });
  if (!member) throw new ApiError(404, "Member not found");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${member.username}-statement.pdf"`);

  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);

  doc.fontSize(20).text("Fair Savings", { align: "left" });
  doc.fontSize(10).fillColor("gray").text("Family Weekly Savings & Loan Management System");
  doc.moveDown();
  doc.fillColor("black").fontSize(14).text(`Member Statement — ${member.name} (${member.username})`);
  doc.fontSize(10).text(`Village: ${member.village ?? "-"}   Phone: ${member.phone ?? "-"}`);
  doc.moveDown();

  doc.fontSize(12).text("Savings Summary", { underline: true });
  doc.fontSize(10).text(`Total Paid: ₹${member.savings?.totalPaid ?? 0}`);
  doc.text(`Weeks Completed: ${member.savings?.weeksCompleted ?? 0} / ${member.savingsCycleWeeks}`);
  doc.text(`Current Balance: ₹${member.savings?.currentBalance ?? 0}`);
  doc.moveDown();

  doc.fontSize(12).text("Loans", { underline: true });
  if (member.loans.length === 0) doc.fontSize(10).text("No loans issued.");
  member.loans.forEach((loan: (typeof member.loans)[number]) => {
    doc
      .fontSize(10)
      .text(
        `₹${loan.principalAmount} @ ${loan.interestRate}% — Status: ${loan.status} — Remaining: ₹${loan.remainingAmount}`
      );
  });
  doc.moveDown();

  doc.fontSize(12).text("Recent Transactions", { underline: true });
  member.transactions.forEach((t: (typeof member.transactions)[number]) => {
    doc.fontSize(9).text(`${t.createdAt.toISOString().slice(0, 10)}  ${t.type}  ₹${t.amount}  ${t.description ?? ""}`);
  });

  doc.end();
});

/** GET /api/reports/collections.xlsx - weekly collection report (admin only) */
router.get("/collections.xlsx", requireRole("ADMIN"), async (_req: AuthRequest, res) => {
  const rows = await prisma.weeklyCollection.findMany({
    include: { member: { select: { name: true, username: true, village: true } } },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Collections");
  sheet.columns = [
    { header: "Member", key: "name", width: 24 },
    { header: "Username", key: "username", width: 12 },
    { header: "Village", key: "village", width: 18 },
    { header: "Week #", key: "weekNumber", width: 10 },
    { header: "Amount Due", key: "amountDue", width: 14 },
    { header: "Amount Paid", key: "amountPaid", width: 14 },
    { header: "Status", key: "status", width: 12 },
    { header: "Payment Date", key: "paymentDate", width: 16 },
  ];
  rows.forEach((r: (typeof rows)[number]) =>
    sheet.addRow({
      name: r.member.name,
      username: r.member.username,
      village: r.member.village,
      weekNumber: r.weekNumber,
      amountDue: r.amountDue,
      amountPaid: r.amountPaid,
      status: r.status,
      paymentDate: r.paymentDate?.toISOString().slice(0, 10) ?? "",
    })
  );
  sheet.getRow(1).font = { bold: true };

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="collection-report.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

export default router;
