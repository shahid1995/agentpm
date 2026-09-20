import crypto from "crypto";
import { randomBytes, randomUUID } from "crypto";
import bcrypt from "bcryptjs";

export const SESSION_TOKEN_BYTES = 32;
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const BCRYPT_ROUNDS = 12;

/**
 * Generate a cryptographically secure session token.
 */
export function generateToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString("hex");
}

/**
 * Hash a session token for database storage.
 * Raw token is never stored — only the hash.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a unique session ID (UUID v4).
 */
export function generateSessionId(): string {
  return randomUUID();
}

/**
 * Hash a password using bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Check if a session is expired based on its expiration date.
 */
export function isSessionExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Calculate the expiration date for a new session.
 */
export function calculateSessionExpiry(): Date {
  return new Date(Date.now() + SESSION_MAX_AGE_MS);
}
