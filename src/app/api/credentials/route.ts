import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse, ApiError } from "../../../lib/api/api-contract";
import { storeCredentialSchema, deleteCredentialSchema } from "../../../lib/api/schemas";
import { CredentialService } from "../../../lib/services/credential-service";
import { AuthService } from "../../../lib/services/auth-service";
import { extractSessionToken } from "../../../lib/api/cookies";
import { extractCsrfToken } from "../../../lib/api/middleware";
import { validateCsrfToken } from "../../../lib/security/csrf";

// Lazy instantiation — services created on first request, not at build time
let credentialService: CredentialService | null = null;
let authService: AuthService | null = null;

function getCredentialService(): CredentialService {
  if (!credentialService) {
    credentialService = new CredentialService();
  }
  return credentialService;
}

function getAuthService(): AuthService {
  if (!authService) {
    authService = new AuthService();
  }
  return authService;
}

async function getAuthenticatedUser(request: NextRequest): Promise<{ userId: string; email: string }> {
  const cookieHeader = request.headers.get("cookie");
  const sessionToken = extractSessionToken(cookieHeader);

  if (!sessionToken) {
    throw new ApiError("UNAUTHORIZED", "Authentication required");
  }

  const session = await getAuthService().resolveSession(sessionToken);
  if (!session) {
    throw new ApiError("UNAUTHORIZED", "Invalid session");
  }

  return { userId: session.userId, email: session.email };
}

function checkCsrf(request: NextRequest): void {
  const headerToken = request.headers.get("x-csrf-token");
  const cookieToken = extractCsrfToken(request.headers.get("cookie"));

  if (!headerToken || !cookieToken) {
    throw new ApiError("FORBIDDEN", "CSRF token missing");
  }

  if (!validateCsrfToken(headerToken, cookieToken)) {
    throw new ApiError("FORBIDDEN", "Invalid CSRF token");
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getAuthenticatedUser(request);
    checkCsrf(request);

    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 1024 * 1024) {
      throw new ApiError("VALIDATION_ERROR", "Request too large");
    }

    const body = await request.json();
    const result = storeCredentialSchema.safeParse(body);
    if (!result.success) {
      throw new ApiError("VALIDATION_ERROR", "Invalid credential data", result.error.flatten());
    }

    const { provider, value } = result.data;

    // Persist through credential service (encrypts + stores in PostgreSQL)
    const metadata = await getCredentialService().storeCredential(user.id, provider, value);

    return NextResponse.json(
      successResponse(metadata, { message: "Credential stored" }),
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    console.error("Credential storage error:", error);
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", "Failed to store credential"),
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getAuthenticatedUser(request);

    // Query persisted credentials from PostgreSQL
    const credentials = await getCredentialService().getCredentials(user.id);

    return NextResponse.json(successResponse({ credentials }));
  } catch (error) {
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", "Failed to fetch credentials"),
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    const user = await getAuthenticatedUser(request);
    checkCsrf(request);

    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 1024 * 1024) {
      throw new ApiError("VALIDATION_ERROR", "Request too large");
    }

    const body = await request.json();
    const result = deleteCredentialSchema.safeParse(body);
    if (!result.success) {
      throw new ApiError("VALIDATION_ERROR", "Invalid credential data", result.error.flatten());
    }

    const { credentialId } = result.data;
    await getCredentialService().deleteCredential(credentialId, user.id);

    return NextResponse.json(successResponse(null, { message: "Credential deleted" }));
  } catch (error) {
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", "Failed to delete credential"),
      { status: 500 }
    );
  }
}
