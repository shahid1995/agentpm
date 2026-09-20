import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "../services/auth-service";
import { extractSessionToken } from "./cookies";
import { ApiError } from "./api-contract";
import { validateCsrfToken } from "../security/csrf";
import { InMemoryRateLimiter } from "../security/rate-limiter";
import { CSRF_COOKIE_NAME } from "./cookies";

// Rate limiters
const authLimiter = new InMemoryRateLimiter({ windowMs: 60000, maxRequests: 5 });
const apiLimiter = new InMemoryRateLimiter({ windowMs: 60000, maxRequests: 100 });

// Request size limits (bytes)
const MAX_REQUEST_SIZE = 1024 * 1024; // 1MB

const authService = new AuthService();

/**
 * Resolve the authenticated user from the request.
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<{ userId: string; email: string } | null> {
  const cookieHeader = request.headers.get("cookie");
  const sessionToken = extractSessionToken(cookieHeader);

  if (!sessionToken) {
    return null;
  }

  const session = await authService.resolveSession(sessionToken);
  if (!session) {
    return null;
  }

  return { userId: session.user.id, email: session.user.email };
}

/**
 * Require authentication or throw.
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ userId: string; email: string }> {
  const user = await authenticateRequest(request);
  if (!user) {
    throw new ApiError("UNAUTHORIZED", "Authentication required");
  }
  return user;
}

/**
 * Check rate limit for a key.
 */
export function checkRateLimit(key: string, type: "auth" | "api" = "api"): void {
  const limiter = type === "auth" ? authLimiter : apiLimiter;
  const result = limiter.check(key);
  if (!result.allowed) {
    throw new ApiError("RATE_LIMITED", "Too many requests");
  }
}

/**
 * Validate CSRF token for state-changing requests.
 */
export function validateCsrf(request: NextRequest): void {
  const headerToken = request.headers.get("x-csrf-token");
  const cookieToken = extractCsrfToken(request.headers.get("cookie"));

  if (!headerToken || !cookieToken) {
    throw new ApiError("FORBIDDEN", "CSRF token missing");
  }

  if (!validateCsrfToken(headerToken, cookieToken)) {
    throw new ApiError("FORBIDDEN", "Invalid CSRF token");
  }
}

/**
 * Check request size.
 */
export function checkRequestSize(request: NextRequest): void {
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
    throw new ApiError("VALIDATION_ERROR", "Request too large");
  }
}

/**
 * Get client IP for rate limiting.
 */
export function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
}

/**
 * Extract CSRF token from cookie.
 */
export function extractCsrfToken(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split("=");
    if (name === CSRF_COOKIE_NAME) {
      return rest.join("=");
    }
  }

  return null;
}
