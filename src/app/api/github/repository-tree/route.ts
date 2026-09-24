import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse, ApiError } from "../../../../lib/api/api-contract";
import { githubTreeRequestSchema } from "../../../../lib/api/schemas";
import {
  authenticate,
  enforceRateLimit,
  enforceRequestSize,
} from "../../../../lib/api/security";
import { CredentialService } from "../../../../lib/services/credential-service";

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
}

interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

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
    // Repository trees are expensive (recursive GitHub API call)
    enforceRateLimit(`github-tree:${user.userId}`, "sensitive");
    await enforceRequestSize(request);

    const body = await request.json();
    const result = githubTreeRequestSchema.safeParse(body);
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

    const githubHeaders = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    // First, get the default branch if not specified
    let targetBranch = result.data.branch;
    if (!targetBranch) {
      const repoResponse = await fetch(`https://api.github.com/repos/${repoPath}`, {
        headers: githubHeaders,
      });
      if (repoResponse.ok) {
        const repoData = await repoResponse.json();
        targetBranch = repoData.default_branch || "main";
      } else {
        targetBranch = "main";
      }
    }

    // Fetch the recursive tree
    const treeUrl = `https://api.github.com/repos/${repoPath}/git/trees/${targetBranch}?recursive=1`;
    const response = await fetch(treeUrl, { headers: githubHeaders });

    if (!response.ok) {
      let errorMsg = `GitHub API error: ${response.status}`;
      try {
        const errBody = await response.json();
        if (errBody.message) errorMsg = errBody.message;
      } catch {
        // ignore
      }
      if (response.status === 404) {
        errorMsg = `Repository or branch '${targetBranch}' not found`;
      }
      if (response.status === 403) {
        errorMsg = `Rate limited or token lacks access (403)`;
      }
      throw new ApiError("GITHUB_ERROR", errorMsg);
    }

    const data: GitHubTreeResponse = await response.json();

    return NextResponse.json(
      successResponse({
        tree: data.tree,
        branch: targetBranch,
        truncated: data.truncated,
      })
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    console.error("[AgentPM API] Repository tree error:", error);
    return NextResponse.json(
      errorResponse("INTERNAL_ERROR", "Failed to fetch repository tree"),
      { status: 500 }
    );
  }
}
