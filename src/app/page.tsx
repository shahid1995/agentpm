"use client";

import * as React from "react";
import { NavBar, type ViewMode } from "@/components/NavBar";
import { KanbanBoard } from "@/components/KanbanBoard";
import { AddTaskModal } from "@/components/AddTaskModal";
import { TaskDetailDrawer } from "@/components/TaskDetailDrawer";
import { SettingsModal } from "@/components/SettingsModal";
import { RepositoryExplorer } from "@/components/RepositoryExplorer";
import { useKanban, COLUMNS } from "@/hooks/useKanban";
import { useGitHub, type GitHubIssue } from "@/hooks/useGitHub";
import { useRepositoryTree } from "@/hooks/useRepositoryTree";
import type { Task } from "@/components/TaskCard";

// Map GitHub issue to local Task
function issueToTask(issue: GitHubIssue): Task {
  const labels = issue.labels.map((l) => l.name.toLowerCase());

  let columnId: string;
  if (issue.state === "closed") {
    columnId = "done";
  } else if (labels.includes("in-review") || labels.includes("under-review") || issue.pull_request) {
    columnId = "under-review";
  } else if (labels.includes("ready-for-agent") || labels.includes("ready")) {
    columnId = "ready-for-agent";
  } else if (labels.includes("planning") || labels.includes("chatgpt-planning")) {
    columnId = "chatgpt-planning";
  } else {
    columnId = "ideas";
  }

  return {
    id: `gh-${issue.id}`,
    title: issue.title,
    description: issue.body?.slice(0, 150) || "",
    contextBoundary: `/issues/${issue.number}`,
    agentPrompt: issue.body || "",
    columnId,
    createdAt: new Date(issue.created_at).getTime(),
  };
}

export default function Home() {
  const { isLoaded: isLocalLoaded, addTask, moveTask, deleteTask, tasks: localTasks } = useKanban();
  const { config, issues, isLoading, error, isLoaded: isGitHubLoaded, saveConfig, clearConfig, fetchIssues, isConfigured } = useGitHub();

  const [modalColumnId, setModalColumnId] = React.useState<string | null>(null);
  const [showGlobalAdd, setShowGlobalAdd] = React.useState(false);
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  const [showSettings, setShowSettings] = React.useState(false);
  const [currentView, setCurrentView] = React.useState<ViewMode>("kanban");

  // Merge local and GitHub tasks
  const allTasks = React.useMemo(() => {
    if (isConfigured && issues.length > 0) {
      const githubTasks = issues.map(issueToTask);
      const localOnly = localTasks.filter((t) => !t.id.startsWith("gh-"));
      return [...githubTasks, ...localOnly];
    }
    return localTasks;
  }, [isConfigured, issues, localTasks]);

  const getTasksByColumn = React.useCallback(
    (columnId: string) => allTasks.filter((t) => t.columnId === columnId),
    [allTasks]
  );

  // Active task boundaries for highlighting
  const activeBoundaries = React.useMemo(() => {
    return allTasks
      .filter((t) => !t.columnId.includes("done"))
      .map((t) => t.contextBoundary);
  }, [allTasks]);

  // Repository tree hook (credentials resolved server-side)
  const repoTree = useRepositoryTree(
    config?.repo || null,
    activeBoundaries
  );

  if (!isLocalLoaded || !isGitHubLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-sm text-zinc-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <NavBar
        title="🤖 AgentPM"
        subtitle="AI Project Manager"
        onAddTask={() => setShowGlobalAdd(true)}
        onSettings={() => setShowSettings(true)}
        isGitHubConnected={isConfigured}
        currentView={currentView}
        onViewChange={setCurrentView}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* GitHub Status Bar */}
        {isConfigured && (
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-100 px-6 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
              <span>
                Connected to <strong>{config?.repo}</strong> — {issues.length} issues
                {repoTree.branch && ` • Branch: ${repoTree.branch}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {error && <span className="text-xs text-red-500">{error}</span>}
              <button
                onClick={fetchIssues}
                disabled={isLoading}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-600 transition hover:bg-zinc-200 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                {isLoading ? "⏳" : "🔄"} Issues
              </button>
              {currentView === "repo" && (
                <button
                  onClick={repoTree.fetchTree}
                  disabled={repoTree.isLoading}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-600 transition hover:bg-zinc-200 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  {repoTree.isLoading ? "⏳" : "🔄"} Tree
                </button>
              )}
            </div>
          </div>
        )}

        {/* View Content */}
        {currentView === "kanban" ? (
          <KanbanBoard
            columns={COLUMNS}
            getTasksByColumn={getTasksByColumn}
            onMove={moveTask}
            onDelete={deleteTask}
            onAddTask={(colId) => setModalColumnId(colId)}
            onCardClick={(task) => setSelectedTask(task)}
          />
        ) : (
          <RepositoryExplorer
            tree={repoTree.tree}
            isLoading={repoTree.isLoading}
            error={repoTree.error}
            onRefresh={repoTree.fetchTree}
            activeTaskBoundaries={activeBoundaries}
            repoName={config?.repo?.split("/")[1] || "Repository"}
          />
        )}
      </main>

      {/* Global Add Task Modal (from navbar) */}
      {showGlobalAdd && (
        <AddTaskModal
          columnId={COLUMNS[0].id}
          onClose={() => setShowGlobalAdd(false)}
          onAdd={addTask}
        />
      )}

      {/* Column-specific Add Task Modal */}
      {modalColumnId && (
        <AddTaskModal
          columnId={modalColumnId}
          onClose={() => setModalColumnId(null)}
          onAdd={addTask}
        />
      )}

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        columns={COLUMNS}
        onClose={() => setSelectedTask(null)}
        isOpen={!!selectedTask}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        config={config}
        onSave={saveConfig}
        onClear={clearConfig}
      />
    </div>
  );
}
