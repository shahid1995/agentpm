"use client";

import * as React from "react";

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  labels: { name: string; color: string }[];
  html_url: string;
  created_at: string;
  updated_at: string;
  user: { login: string; avatar_url: string };
  pull_request?: { url: string };
}

export interface GitHubConfig {
  repo: string;
}

/**
 * Custom hook for fetching and managing GitHub Issues.
 * Credentials are stored server-side (PostgreSQL), not in localStorage.
 */
export function useGitHub() {
  const [config, setConfig] = React.useState<GitHubConfig | null>(null);
  const [issues, setIssues] = React.useState<GitHubIssue[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(() => {
    setIsLoaded(true);
  }, []);

  const saveConfig = React.useCallback(async (newConfig: GitHubConfig) => {
    setConfig(newConfig);
  }, []);

  const clearConfig = React.useCallback(() => {
    setConfig(null);
    setIssues([]);
    setError(null);
  }, []);

  const fetchIssues = React.useCallback(async () => {
    if (!config?.repo) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/github/issues", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo: config.repo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errMsg = data.error || `API error: ${response.status}`;
        throw new Error(errMsg);
      }
      setIssues(data.issues || []);
    } catch (err) {
      console.error("[AgentPM] Fetch error:", err);
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError("Network error — check internet connection");
      } else {
        setError(err instanceof Error ? err.message : "Failed to fetch issues");
      }
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  React.useEffect(() => {
    if (config?.repo) {
      fetchIssues();
    }
  }, [config, fetchIssues]);

  return {
    config,
    issues,
    isLoading,
    error,
    isLoaded,
    saveConfig,
    clearConfig,
    fetchIssues,
    isConfigured: !!config?.repo,
  };
}
