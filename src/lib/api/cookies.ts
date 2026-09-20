import { SESSION_MAX_AGE_MS } from "../security/auth";

export const SESSION_COOKIE_NAME = "agentpm_session";
export const CSRF_COOKIE_NAME = "agentpm_csrf";
const MAX_AGE_SECONDS = Math.floor(SESSION_MAX_AGE_MS / 1000);

/**
 * Create a Set-Cookie header value for the session cookie.
 * HttpOnly, Secure, SameSite=Strict.
 */
export function createSessionCookie(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_SECONDS}`;
}

/**
 * Create a Set-Cookie header value for the CSRF token.
 * NOT HttpOnly (JavaScript must read it and send in x-csrf-token header).
 * Secure, SameSite=Strict.
 */
export function createCsrfCookie(token: string): string {
  return `${CSRF_COOKIE_NAME}=${token}; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_SECONDS}`;
}

/**
 * Create a Set-Cookie header value to clear the session cookie.
 */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

/**
 * Extract session token from a Cookie header value.
 */
export function extractSessionToken(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split("=");
    if (name === SESSION_COOKIE_NAME) {
      return rest.join("=");
    }
  }

  return null;
}
