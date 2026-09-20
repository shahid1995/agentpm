import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse, ApiError } from "../../../../lib/api/api-contract";
import { githubIssuesRequestSchema } from "../../../../lib/api/schemas";
import {
  authenticate,
  enforceRateLimit,
  enforceRequestSize,
} from "../../../../lib/api/security";
import { CredentialService } from "../../../../lib/services/credential-service";

let credentialService: CredentialService | null = null;

function getCredentialService(): CredentialService {
  if (!credentialService) {
    credentialService = new CredentialService();
  }
  return credentialService;
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Phase 1 security boundary: auth → rate limit → size → validation
    const user = await authenticate(request);
    enforceRateLimit(`github-issues:${user.userId}`, "api");
    enforceRequestSize(request);

    const body = await request.json();
    const result = githubIssuesRequestSchema.safeParse(body);
    if (!result.success) {
      throw new ApiError("VALIDATION_ERROR", "Invalid request", result.error.flatten());
    }

    const rawRepo = result.data.repo.trim();
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
