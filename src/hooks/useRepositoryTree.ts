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
 * Credentials are resolved server-side.
 */
export function useRepositoryTree(
  repo: string | null,
  activeBoundaries: string[] = []
) {
  const [tree, setTree] = React.useState<TreeNode[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [branch, setBranch] = React.useState<string | null>(null);

  const fetchTree = React.useCallback(async () => {
    if (!repo) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/github/repository-tree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo }),
      });

      if (!response.ok) {
        let errorMsg = `API error: ${response.status}`;
        try {
          const errBody = await response.json();
          if (errBody?.error?.message) errorMsg = errBody.error.message;
        } catch {
          // ignore
        }
        throw new Error(errorMsg);
      }

      const json: { data: GitHubTreeResponse } = await response.json();
      const data = json.data;
      const treeData = buildTreeFromGitHubResponse(data.tree || [], activeBoundaries);
      setTree(treeData);
      setBranch(data.branch || null);
    } catch (err) {
      console.error("[AgentPM] Repository tree error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch repository tree");
      setTree(null);
    } finally {
      setIsLoading(false);
    }
  }, [repo, activeBoundaries]);

  React.useEffect(() => {
    if (repo) {
      fetchTree();
    }
  }, [repo, fetchTree]);

  return {
    tree,
    isLoading,
    error,
    branch,
    fetchTree,
    setTree,
  };
}
