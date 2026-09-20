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
  token: string;
  openaiKey?: string;
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

  // Load credentials from server-side API on mount
  React.useEffect(() => {
    const loadCredentials = async () => {
      try {
        const response = await fetch("/api/credentials");
        if (response.ok) {
          const data = await response.json();
          if (data.data?.credentials?.length > 0) {
            const githubCred = data.data.credentials.find(
              (c: { provider: string }) => c.provider === "github"
            );
            if (githubCred) {
              setConfig({
                repo: "",
                token: "",
                openaiKey: "",
              });
            }
          }
        }
      } catch {
        // ignore
      }
      setIsLoaded(true);
    };
    loadCredentials();
  }, []);

  // Save credentials to server-side API
  const saveConfig = React.useCallback(async (newConfig: GitHubConfig) => {
    try {
      // Store GitHub token
      if (newConfig.token) {
        await fetch("/api/credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "github",
            value: newConfig.token,
          }),
        });
      }
      // Store OpenAI token
      if (newConfig.openaiKey) {
        await fetch("/api/credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "openai",
            value: newConfig.openaiKey,
          }),
        });
      }
      setConfig(newConfig);
    } catch (err) {
      console.error("[AgentPM] Failed to save credentials:", err);
    }
  }, []);

  const clearConfig = React.useCallback(async () => {
    try {
      // Clear credentials from server
      await fetch("/api/credentials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // ignore
    }
    setConfig(null);
    setIssues([]);
    setError(null);
  }, []);

  // Fetch issues from local API proxy
  const fetchIssues = React.useCallback(async () => {
    if (!config?.repo || !config?.token) return;

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
          token: config.token,
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

  // Auto-fetch when config is set
  React.useEffect(() => {
    if (config?.repo && config?.token) {
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
    isConfigured: !!(config?.repo && config?.token),
  };
}
