import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export type JwtRole = "ADMIN" | "MEMBER" | "BORROWER";

export interface JwtPayload {
  id: string;
  role: JwtRole;
  username: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Generates a random password like "Kd7f#2Lm9"
 */
export function generateRandomPassword(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * Generates the next sequential member username, e.g. KD001, KD002...
 * Scans ALL existing usernames matching the prefix and takes the true
 * numeric max - NOT a string sort, which silently breaks the moment any
 * username doesn't fit the exact zero-padded pattern (stray records,
 * inconsistent padding, gaps from deletions, etc).
 */
export function nextUsernameFromList(existingUsernames: string[], prefix = "KD"): string {
  let max = 0;
  for (const username of existingUsernames) {
    if (!username.startsWith(prefix)) continue;
    const num = parseInt(username.slice(prefix.length), 10);
    if (!isNaN(num) && num > max) max = num;
  }
  const next = (max + 1).toString().padStart(3, "0");
  return `${prefix}${next}`;
}
