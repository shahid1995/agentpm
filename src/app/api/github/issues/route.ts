import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse, ApiError } from "../../../../lib/api/api-contract";
import { CredentialService } from "../../../../lib/services/credential-service";
import { AuthService } from "../../../../lib/services/auth-service";
import { extractSessionToken } from "../../../../lib/api/cookies";

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

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getAuthenticatedUser(request);

    const body = await request.json();
    const { repo } = body;

    if (!repo) {
      throw new ApiError("VALIDATION_ERROR", "Missing repo parameter");
    }

    // Validate repo format
    const rawRepo = repo.trim();
    if (!rawRepo.includes("/") || rawRepo.startsWith("/") || rawRepo.endsWith("/")) {
      throw new ApiError("VALIDATION_ERROR", "Invalid format: use 'owner/repo'");
    }

    // Resolve GitHub token from server-side encrypted credential
    const token = await getCredentialService().getDecryptedCredential(user.userId, "github");
    if (!token) {
      throw new ApiError("NOT_FOUND", "GitHub credential not configured");
    }

    const repoPath = rawRepo
      .split("/")
      .map((p: string) => encodeURIComponent(p.trim()))
      .join("/");

    const url = `https://api.github.com/repos/${repoPath}/issues?state=all&per_page=100`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      let errorMsg = `GitHub API error: ${response.status} for repo '${rawRepo}'`;
      try {
        const errBody = await response.json();
        if (errBody.message) errorMsg = errBody.message;
      } catch {
        // ignore
      }
      if (response.status === 404) {
        errorMsg = `Repository '${rawRepo}' not found`;
      }
      if (response.status === 401) {
        errorMsg = `Authentication failed (401)`;
      }
      if (response.status === 403) {
        errorMsg = `Access denied (403)`;
      }
      throw new ApiError("GITHUB_ERROR", errorMsg);
    }

    const data = await response.json();
    const issues = data.filter((item: { pull_request?: unknown }) => !item.pull_request);

    return NextResponse.json(successResponse({ issues }));
  } catch (error) {
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    console.error("[AgentPM API] GitHub proxy error:", error);
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", "Failed to fetch issues"),
      { status: 500 }
    );
  }
}
