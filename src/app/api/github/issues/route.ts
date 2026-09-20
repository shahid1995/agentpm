import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repo, token } = body;

    if (!repo || !token) {
      return NextResponse.json(
        { error: "Missing repo or token" },
        { status: 400 }
      );
    }

    // Validate repo format
    const rawRepo = repo.trim();
    if (!rawRepo.includes("/") || rawRepo.startsWith("/") || rawRepo.endsWith("/")) {
      return NextResponse.json(
        { error: "Invalid format: use 'owner/repo'" },
        { status: 400 }
      );
    }

    // Encode path segments
    const repoPath = rawRepo
      .split("/")
      .map((p: string) => encodeURIComponent(p.trim()))
      .join("/");

    const url = `https://api.github.com/repos/${repoPath}/issues?state=all&per_page=100`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
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
        errorMsg = `Repository '${rawRepo}' not found. Check the name is correct and token has 'repo' scope.`;
      }
      if (response.status === 401) {
        errorMsg = `Authentication failed (401). Check your GitHub token is valid.`;
      }
      if (response.status === 403) {
        errorMsg = `Access denied (403). Token may lack 'repo' scope or rate limited.`;
      }
      return NextResponse.json({ error: errorMsg }, { status: response.status });
    }

    const data = await response.json();
    // Filter out pull requests
    const issues = data.filter((item: { pull_request?: unknown }) => !item.pull_request);

    return NextResponse.json({ issues });
  } catch (error) {
    console.error("[AgentPM API] GitHub proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
