import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse, ApiError } from "../../../lib/api/api-contract";
import { storeCredentialSchema, deleteCredentialSchema } from "../../../lib/api/schemas";
import {
  authenticate,
  enforceRateLimit,
  enforceCsrf,
  enforceRequestSize,
} from "../../../lib/api/security";
import { CredentialService } from "../../../lib/services/credential-service";

// Lazy instantiation — services created on first request, not at build time
let credentialService: CredentialService | null = null;

function getCredentialService(): CredentialService {
  if (!credentialService) {
    credentialService = new CredentialService();
  }
  return credentialService;
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Phase 1 security boundary: auth → rate-limit → CSRF → size → validation
    const user = await authenticate(request);
    // Credential writes handle secrets — use the sensitive tier (10/min)
    enforceRateLimit(`credentials:${user.userId}`, "sensitive");
    enforceCsrf(request);
    await enforceRequestSize(request);

    const body = await request.json();
    const result = storeCredentialSchema.safeParse(body);
    if (!result.success) {
      throw new ApiError("VALIDATION_ERROR", "Invalid credential data", result.error.flatten());
    }

    const { provider, value } = result.data;

    // Persist through credential service (encrypts + stores in PostgreSQL)
    const metadata = await getCredentialService().storeCredential(user.userId, provider, value);

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
    // Phase 1 security boundary: auth → rate-limit → validation
    const user = await authenticate(request);
    enforceRateLimit(`credentials:${user.userId}`, "sensitive");

    // Query persisted credentials from PostgreSQL
    const credentials = await getCredentialService().getCredentials(user.userId);

    return NextResponse.json(successResponse({ credentials }));
  } catch (error) {
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    console.error("Credential fetch error:", error);
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", "Failed to fetch credentials"),
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    // Phase 1 security boundary: auth → rate-limit → CSRF → size → validation
    const user = await authenticate(request);
    enforceRateLimit(`credentials:${user.userId}`, "sensitive");
    enforceCsrf(request);
    await enforceRequestSize(request);

    const body = await request.json();
    const result = deleteCredentialSchema.safeParse(body);
    if (!result.success) {
      throw new ApiError("VALIDATION_ERROR", "Invalid credential data", result.error.flatten());
    }

    const { credentialId } = result.data;
    const deleted = await getCredentialService().deleteCredential(credentialId, user.userId);

    if (!deleted) {
      throw new ApiError("NOT_FOUND", "Credential not found");
    }

    return NextResponse.json(successResponse(null, { message: "Credential deleted" }));
  } catch (error) {
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    console.error("Credential deletion error:", error);
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", "Failed to delete credential"),
      { status: 500 }
    );
  }
}
