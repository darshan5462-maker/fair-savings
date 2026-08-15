import { Router } from "express";
import { runSeed } from "../utils/seedData";
import { prisma } from "../config/prisma";
import { ApiError } from "../middleware/errorHandler";

const router = Router();

/**
 * GET /api/dev/seed?secret=...
 * Runs the same seed logic as `npm run prisma:seed`, over HTTP — for hosts
 * (like Render's free tier) that don't offer a shell. Only works if the
 * SEED_SECRET environment variable is set on the server AND matches the
 * `secret` query param. Safe to call more than once (idempotent upserts).
 *
 * Recommended: remove or rotate SEED_SECRET after you've seeded once.
 */
router.get("/seed", async (req, res) => {
  const expected = process.env.SEED_SECRET;
  if (!expected) {
    throw new ApiError(404, "Not found");
  }
  if (req.query.secret !== expected) {
    throw new ApiError(403, "Invalid secret");
  }

  const log = await runSeed();
  res.json({ success: true, log });
});

/**
 * GET /api/dev/reconcile-penalties?secret=...
 * One-time cleanup for data created by two now-fixed bugs in the penalty
 * engine: (1) penalties firing on the due date itself instead of the day
 * after, and (2) a family payer being penalized for "missing" savings that
 * were never individually theirs to pay in the first place. Removes the
 * erroneous penalty + transaction rows this produced, then recomputes every
 * member's defaulter flag from their actual current data. Safe to run more
 * than once - each pass only removes what's still actually wrong.
 */
router.get("/reconcile-penalties", async (req, res) => {
  const expected = process.env.SEED_SECRET;
  if (!expected) {
    throw new ApiError(404, "Not found");
  }
  if (req.query.secret !== expected) {
    throw new ApiError(403, "Invalid secret");
  }

  const log: string[] = [];

  // 1. A payer-with-children should never have savings penalties or missed-week
  //    records of their own - remove any that exist from the earlier bug.
  const payers = await prisma.member.findMany({
    where: { payerRelations: { some: {} } },
    select: { id: true, name: true },
  });
  for (const payer of payers) {
    const penalties = await prisma.penalty.findMany({ where: { memberId: payer.id, loanId: null } });
    for (const p of penalties) {
      await prisma.transaction.deleteMany({ where: { referenceId: p.id, type: "PENALTY" } });
      await prisma.penalty.delete({ where: { id: p.id } });
      log.push(`Removed erroneous penalty for payer "${payer.name}": ${p.reason}`);
    }

    const missedRows = await prisma.weeklyCollection.findMany({ where: { memberId: payer.id, status: "MISSED" } });
    for (const row of missedRows) {
      await prisma.weeklyCollection.delete({ where: { id: row.id } });
      log.push(`Removed erroneous "missed week ${row.weekNumber}" record for payer "${payer.name}"`);
    }
  }

  // 2. Any savings penalty whose week is now actually PAID was a false
  //    positive from the same-day midnight-comparison bug - remove it.
  const savingsPenalties = await prisma.penalty.findMany({ where: { loanId: null } });
  for (const p of savingsPenalties) {
    const match = p.reason.match(/Missed savings - week (\d+)/);
    if (!match) continue;
    const weekNumber = parseInt(match[1], 10);
    const collection = await prisma.weeklyCollection.findUnique({
      where: { memberId_weekNumber: { memberId: p.memberId, weekNumber } },
    });
    if (collection && collection.status === "PAID") {
      await prisma.transaction.deleteMany({ where: { referenceId: p.id, type: "PENALTY" } });
      await prisma.penalty.delete({ where: { id: p.id } });
      log.push(`Removed stale penalty for week ${weekNumber} (now paid) on member ${p.memberId}`);
    }
  }

  // 3. Recompute every member's defaulter flag from their actual current
  //    data - it was previously only ever set to true, never cleared.
  const allMembers = await prisma.member.findMany({ select: { id: true } });
  for (const m of allMembers) {
    const missedSavings = await prisma.weeklyCollection.count({ where: { memberId: m.id, status: "MISSED" } });
    const missedLoan = await prisma.loanPayment.count({ where: { status: "MISSED", loan: { memberId: m.id } } });
    await prisma.member.update({
      where: { id: m.id },
      data: { isDefaulter: missedSavings > 0 || missedLoan > 0 },
    });
  }
  log.push(`Recomputed defaulter status for ${allMembers.length} member(s)`);

  res.json({ success: true, log });
});

export default router;
