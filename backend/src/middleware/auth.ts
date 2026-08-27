import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../utils/auth";

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authentication token missing" });
  }
  const token = header.split(" ")[1];
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

export function requireRole(...roles: Array<"ADMIN" | "MEMBER" | "BORROWER">) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    next();
  };
}

// Ensures a logged-in MEMBER can only ever act on their own record.
export function requireSelfOrAdmin(paramName = "id") {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role === "ADMIN") return next();
    if (req.user?.role === "MEMBER" && req.user.id === req.params[paramName]) return next();
    return res.status(403).json({ success: false, message: "Access denied" });
  };
}
