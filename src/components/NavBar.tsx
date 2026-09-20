import * as React from "react";

export type ViewMode = "kanban" | "repo";

export interface NavBarProps {
  title: string;
  subtitle?: string;
  onAddTask?: () => void;
  onSettings?: () => void;
  isGitHubConnected?: boolean;
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

/**
 * Top navigation bar with brand title, subtitle, and view toggle.
 */
export function NavBar({ title, subtitle, onAddTask, onSettings, isGitHubConnected, currentView, onViewChange }: NavBarProps) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </h1>
        {subtitle && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {subtitle}
          </span>
        )}
        {isGitHubConnected && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            ● GitHub Connected
          </span>
        )}
      </div>
      <nav className="flex items-center gap-3">
        {/* View Toggle */}
        <div className="flex rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
          <button
            onClick={() => onViewChange("kanban")}
            className={`rounded-l-md px-3 py-1.5 text-xs font-medium transition ${
              currentView === "kanban"
                ? "bg-blue-600 text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            📋 Kanban
          </button>
          <button
            onClick={() => onViewChange("repo")}
            className={`rounded-r-md px-3 py-1.5 text-xs font-medium transition ${
              currentView === "repo"
                ? "bg-blue-600 text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            📂 Repository Explorer
          </button>
        </div>

        <button
          onClick={onAddTask}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          + New Task
        </button>
        <button
          onClick={onSettings}
          className="rounded-md border border-zinc-200 p-1.5 text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          title="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </nav>
    </header>
  );
}
