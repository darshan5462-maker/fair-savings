import { Request, Response, NextFunction } from "express";

/**
 * Prisma's Decimal fields serialize to STRINGS via JSON.stringify (Decimal.js's
 * toJSON() returns a string, not a number). Left unhandled, that turns any
 * frontend `sum + value` into string concatenation instead of addition -
 * e.g. "500" + "100" = "500100" instead of 600.
 *
 * This middleware walks every JSON response body and converts anything
 * Decimal-shaped into a real number, so every API response is safe to do
 * arithmetic on without each caller needing to remember to wrap in Number().
 */
function isDecimalLike(value: any): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.toNumber === "function" &&
    typeof value.toFixed === "function"
  );
}

function serializeDecimals(value: any): any {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serializeDecimals);
  if (value instanceof Date) return value;
  if (isDecimalLike(value)) return value.toNumber();
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const key of Object.keys(value)) out[key] = serializeDecimals(value[key]);
    return out;
  }
  return value;
}

export function decimalSerializer(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);
  res.json = (body: any) => originalJson(serializeDecimals(body));
  next();
}
