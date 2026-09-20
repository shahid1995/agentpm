import crypto from "crypto";

const CSRF_TOKEN_BYTES = 32;

/**
 * Generate a CSRF token for the session.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_BYTES).toString("hex");
}

/**
 * Validate a CSRF token using constant-time comparison.
 * The token from the request header must match the token from the session.
 */
export function validateCsrfToken(requestToken: string, sessionToken: string): boolean {
  if (!requestToken || !sessionToken) {
    return false;
  }

  const requestBuffer = Buffer.from(requestToken);
  const sessionBuffer = Buffer.from(sessionToken);

  if (requestBuffer.length !== sessionBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(requestBuffer, sessionBuffer);
}
