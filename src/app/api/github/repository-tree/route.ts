import { NextRequest, NextResponse } from "next/server";

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repo, token, branch } = body;

    if (!repo || !token) {
      return NextResponse.json(
        { error: "Missing repo or token" },
        { status: 400 }
      );
    }

    const rawRepo = repo.trim();
    if (!rawRepo.includes("/") || rawRepo.startsWith("/") || rawRepo.endsWith("/")) {
      return NextResponse.json(
        { error: "Invalid format: use 'owner/repo'" },
        { status: 400 }
      );
    }

    const repoPath = rawRepo
      .split("/")
      .map((p: string) => encodeURIComponent(p.trim()))
      .join("/");

    // First, get the default branch if not specified
    let targetBranch = branch;
    if (!targetBranch) {
      const repoResponse = await fetch(`https://api.github.com/repos/${repoPath}`, {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
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
    const response = await fetch(treeUrl, {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

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
      return NextResponse.json({ error: errorMsg }, { status: response.status });
    }

    const data: GitHubTreeResponse = await response.json();

    return NextResponse.json({
      tree: data.tree,
      branch: targetBranch,
      truncated: data.truncated,
    });
  } catch (error) {
    console.error("[AgentPM API] Repository tree error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
