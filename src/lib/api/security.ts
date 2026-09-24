import { NextRequest } from "next/server";
import { ApiError } from "./api-contract";
import { AuthService } from "../services/auth-service";
import { AuthorizationService } from "../services/authorization-service";
import { extractSessionToken } from "./cookies";
import { extractCsrfToken } from "./middleware";
import { validateCsrfToken } from "../security/csrf";
import { InMemoryRateLimiter } from "../security/rate-limiter";

// Rate limiters
const authLimiter = new InMemoryRateLimiter({ windowMs: 60000, maxRequests: 5 });
const apiLimiter = new InMemoryRateLimiter({ windowMs: 60000, maxRequests: 100 });
const sensitiveLimiter = new InMemoryRateLimiter({ windowMs: 60000, maxRequests: 10 });

let authService: AuthService | null = null;
let authorizationService: AuthorizationService | null = null;

function getAuthService(): AuthService {
  if (!authService) {
    authService = new AuthService();
  }
  return authService;
}

function getAuthorizationService(): AuthorizationService {
  if (!authorizationService) {
    authorizationService = new AuthorizationService();
  }
  return authorizationService;
}

const MAX_REQUEST_SIZE = 1024 * 1024; // 1MB

export interface SecurityContext {
  userId: string;
  email: string;
}

/**
 * Authenticate request and return user context.
 */
export async function authenticate(request: NextRequest): Promise<SecurityContext> {
  const cookieHeader = request.headers.get("cookie");
  const sessionToken = extractSessionToken(cookieHeader);

  if (!sessionToken) {
    throw new ApiError("UNAUTHORIZED", "Authentication required");
  }

  const session = await getAuthService().resolveSession(sessionToken);
  if (!session) {
    throw new ApiError("UNAUTHORIZED", "Invalid or expired session");
  }

  return { userId: session.userId, email: session.email };
}

/**
 * Enforce rate limiting for an endpoint.
 */
export function enforceRateLimit(
  key: string,
  type: "auth" | "api" | "sensitive" = "api"
): void {
  const limiter =
    type === "auth" ? authLimiter : type === "sensitive" ? sensitiveLimiter : apiLimiter;
  const result = limiter.check(key);
  if (!result.allowed) {
    throw new ApiError("RATE_LIMITED", "Too many requests. Please try again later.");
  }
}

/**
 * Enforce CSRF protection for state-changing requests.
 */
export function enforceCsrf(request: NextRequest): void {
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
 * Enforce the 1 MiB request-body limit.
 *
 * Boundary: an explicitly declared oversized Content-Length is rejected
 * immediately. The authoritative check measures the actual body via a
 * clone, so the route can still read the original body afterwards. This
 * covers absent, unparseable, or understated Content-Length values.
 */
export async function enforceRequestSize(request: NextRequest): Promise<void> {
  // Fast path: early rejection when an oversized Content-Length is declared.
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsed = parseInt(contentLength, 10);
    if (!Number.isNaN(parsed) && parsed > MAX_REQUEST_SIZE) {
      throw new ApiError("VALIDATION_ERROR", "Request too large");
    }
  }

  // Authoritative check: measure the actual received body.
  const cloned = request.clone();
  const body = await cloned.arrayBuffer();
  if (body.byteLength > MAX_REQUEST_SIZE) {
    throw new ApiError("VALIDATION_ERROR", "Request too large");
  }
}

/**
 * Authorize project-scoped access.
 * Resolves actual membership from database — never trusts client role.
 */
export async function authorizeProjectAccess(
  userId: string,
  projectId: string,
  requiredRole: "owner" | "member" = "member"
): Promise<void> {
  const authz = getAuthorizationService();

  // Check project exists
  const exists = await authz.projectExists(projectId);
  if (!exists) {
    throw new ApiError("NOT_FOUND", "Project not found");
  }

  // Resolve actual role from database
  const role = await authz.resolveProjectRole(userId, projectId);

  if (!role) {
    throw new ApiError("FORBIDDEN", "Access denied");
  }

  if (requiredRole === "owner" && role !== "owner") {
    throw new ApiError("FORBIDDEN", "Owner access required");
  }
}

/**
 * Get client IP for rate limiting.
 */
export function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
}
