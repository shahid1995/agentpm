"use client";

import * as React from "react";
import { buildTreeFromGitHubResponse, type TreeNode } from "@/components/RepositoryExplorer";

interface GitHubTreeItem {
  path: string;
  type: "blob" | "tree";
}

interface GitHubTreeResponse {
  tree: GitHubTreeItem[];
  branch: string;
  truncated: boolean;
}

/**
 * Custom hook for fetching and managing the repository file tree.
 */
export function useRepositoryTree(
  repo: string | null,
  token: string | null,
  activeBoundaries: string[] = []
) {
  const [tree, setTree] = React.useState<TreeNode[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [branch, setBranch] = React.useState<string | null>(null);

  const fetchTree = React.useCallback(async () => {
    if (!repo || !token) {
      setError("Please configure GitHub repository in Settings");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/github/repository-tree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo, token }),
      });

      if (!response.ok) {
        let errorMsg = `API error: ${response.status}`;
        try {
          const errBody = await response.json();
          if (errBody.error) errorMsg = errBody.error;
        } catch {
          // ignore
        }
        throw new Error(errorMsg);
      }

      const data: GitHubTreeResponse = await response.json();
      const treeData = buildTreeFromGitHubResponse(data.tree, activeBoundaries);
      setTree(treeData);
      setBranch(data.branch);
    } catch (err) {
      console.error("[AgentPM] Repository tree error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch repository tree");
      setTree(null);
    } finally {
      setIsLoading(false);
    }
  }, [repo, token, activeBoundaries]);

  // Auto-fetch when repo/token change
  React.useEffect(() => {
    if (repo && token) {
      fetchTree();
    }
  }, [repo, token, fetchTree]);

  return {
    tree,
    isLoading,
    error,
    branch,
    fetchTree,
    setTree,
  };
}
