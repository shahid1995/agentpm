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
  repo: string; // "username/repo"
  token: string;
  openaiKey?: string;
}

const GITHUB_CONFIG_KEY = "agentpm-github-config";
const OPENAI_KEY_KEY = "agentpm-openai-key";

/**
 * Custom hook for fetching and managing GitHub Issues.
 */
export function useGitHub() {
  const [config, setConfig] = React.useState<GitHubConfig | null>(null);
  const [issues, setIssues] = React.useState<GitHubIssue[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);

  // Load config from localStorage on mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(GITHUB_CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.repo && parsed.token) {
          setConfig(parsed);
        }
      }
    } catch {
      // ignore
    }
    setIsLoaded(true);
  }, []);

  // Save config to localStorage
  const saveConfig = React.useCallback((newConfig: GitHubConfig) => {
    localStorage.setItem(GITHUB_CONFIG_KEY, JSON.stringify(newConfig));
    setConfig(newConfig);
  }, []);

  const clearConfig = React.useCallback(() => {
    localStorage.removeItem(GITHUB_CONFIG_KEY);
    // Preserve OpenAI key if it exists
    const openaiKey = localStorage.getItem(OPENAI_KEY_KEY);
    setConfig(null);
    setIssues([]);
    setError(null);
    if (openaiKey) {
      setConfig({ repo: "", token: "", openaiKey });
    }
  }, []);

  // Fetch issues from local API proxy (avoids CORS)
  const fetchIssues = React.useCallback(async () => {
    if (!config?.repo || !config?.token) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log(`[AgentPM] Fetching issues via proxy for: ${config.repo}`);

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

      console.log(`[AgentPM] Proxy response status: ${response.status}`);

      const data = await response.json();

      if (!response.ok) {
        const errMsg = data.error || `API error: ${response.status}`;
        throw new Error(errMsg);
      }
      setIssues(data.issues || []);
      console.log(`[AgentPM] Fetched ${data.issues?.length || 0} issues`);
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
