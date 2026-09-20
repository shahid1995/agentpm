"use client";

import * as React from "react";

export interface GitHubConfig {
  repo: string;
  token: string;
  openaiKey?: string;
}

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GitHubConfig | null;
  onSave: (config: GitHubConfig) => void;
  onClear: () => void;
}

/**
 * Settings modal for GitHub integration and OpenAI configuration.
 */
export function SettingsModal({ isOpen, onClose, config, onSave, onClear }: SettingsModalProps) {
  const [repo, setRepo] = React.useState(config?.repo || "");
  const [token, setToken] = React.useState(config?.token || "");
  const [openaiKey, setOpenaiKey] = React.useState("");

  // Load OpenAI key from separate localStorage key
  React.useEffect(() => {
    const storedKey = localStorage.getItem("agentpm-openai-key");
    if (storedKey) setOpenaiKey(storedKey);
  }, []);

  React.useEffect(() => {
    setRepo(config?.repo || "");
    setToken(config?.token || "");
  }, [config, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repo.trim() || !token.trim()) return;
    
    // Save OpenAI key to separate localStorage key for useChatGPT hook
    if (openaiKey.trim()) {
      localStorage.setItem("agentpm-openai-key", openaiKey.trim());
      window.dispatchEvent(new Event("agentpm-openai-key-changed"));
    }
    
    onSave({ repo: repo.trim(), token: token.trim(), openaiKey: openaiKey.trim() });
    onClose();
  };

  const handleClear = () => {
    onClear();
    setRepo("");
    setToken("");
    setOpenaiKey("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            ⚙️ Settings
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              GitHub Repository
            </label>
            <input
              type="text"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="e.g., owner/repo (hyphens OK)"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Personal Access Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              required
            />
            <p className="mt-1 text-[10px] text-zinc-400">
              Token needs <code className="font-mono">repo</code> scope. Stored in your browser only.
            </p>
          </div>

          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              OpenAI API Key (Optional)
            </label>
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <p className="mt-1 text-[10px] text-zinc-400">
              Enables built-in ChatGPT planner. Stored in your browser only.
            </p>
          </div>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={handleClear}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
            >
              Disconnect
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!repo.trim() || !token.trim()}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save & Connect
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
