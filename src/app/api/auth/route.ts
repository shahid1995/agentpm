import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "../../../lib/services/auth-service";
import { registerSchema, loginSchema } from "../../../lib/api/schemas";
import { successResponse, errorResponse, ApiError } from "../../../lib/api/api-contract";
import { createSessionCookie, createCsrfCookie, clearSessionCookie } from "../../../lib/api/cookies";
import { requireAuth, checkRateLimit, getClientIp, validateCsrf } from "../../../lib/api/middleware";
import { generateCsrfToken } from "../../../lib/security/csrf";

const authService = new AuthService();

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const ip = getClientIp(request);
    checkRateLimit(ip, "auth");

    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      throw new ApiError("VALIDATION_ERROR", "Content-Type must be application/json");
    }

    const body = await request.json();
    const url = new URL(request.url);
    const action = url.pathname.split("/").pop();

    if (action === "register") {
      return await handleRegister(body);
    } else if (action === "login") {
      return await handleLogin(body);
    } else if (action === "logout") {
      return await handleLogout(request);
    }

    throw new ApiError("NOT_FOUND", "Unknown action");
  } catch (error) {
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    console.error("Auth error:", error);
    return NextResponse.json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"), { status: 500 });
  }
}

async function handleRegister(body: unknown): Promise<Response> {
  const result = registerSchema.safeParse(body);
  if (!result.success) {
    throw new ApiError("VALIDATION_ERROR", "Invalid registration data", result.error.flatten());
  }

  const { email, password } = result.data;
  const { user, sessionToken } = await authService.register(email, password);

  const response = NextResponse.json(
    successResponse(
      { user: { id: user.id, email: user.email } },
      { message: "Registration successful" }
    ),
    { status: 201 }
  );

  response.headers.append("Set-Cookie", createSessionCookie(sessionToken));
  response.headers.append("Set-Cookie", createCsrfCookie(generateCsrfToken()));

  return response;
}

async function handleLogin(body: unknown): Promise<Response> {
  const result = loginSchema.safeParse(body);
  if (!result.success) {
    throw new ApiError("VALIDATION_ERROR", "Invalid login data", result.error.flatten());
  }

  const { email, password } = result.data;
  const { user, sessionToken } = await authService.login(email, password);

  const response = NextResponse.json(
    successResponse(
      { user: { id: user.id, email: user.email } },
      { message: "Login successful" }
    )
  );

  response.headers.append("Set-Cookie", createSessionCookie(sessionToken));
  response.headers.append("Set-Cookie", createCsrfCookie(generateCsrfToken()));

  return response;
}

async function handleLogout(request: NextRequest): Promise<Response> {
  validateCsrf(request);

  const cookieHeader = request.headers.get("cookie");
  const token = cookieHeader
    ?.split(";")
    .find((c) => c.trim().startsWith("agentpm_session="))
    ?.split("=")[1];

  if (token) {
    await authService.logout(token.trim());
  }

  const response = NextResponse.json(successResponse(null, { message: "Logged out" }));
  response.headers.append("Set-Cookie", clearSessionCookie());
  return response;
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const url = new URL(request.url);
    const action = url.pathname.split("/").pop();

    if (action === "session") {
      return await handleGetSession(request);
    }

    throw new ApiError("NOT_FOUND", "Unknown action");
  } catch (error) {
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return NextResponse.json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred"), { status: 500 });
  }
}

async function handleGetSession(request: NextRequest): Promise<Response> {
  const user = await requireAuth(request);
  return NextResponse.json(successResponse({ user }));
}
