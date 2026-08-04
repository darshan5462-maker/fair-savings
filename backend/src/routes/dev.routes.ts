import { Router } from "express";
import { runSeed } from "../utils/seedData";
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

export default router;
