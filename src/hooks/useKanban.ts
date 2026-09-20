"use client";

import * as React from "react";

export interface Task {
  id: string;
  title: string;
  description: string;
  contextBoundary: string;
  agentPrompt: string;
  columnId: string;
  createdAt: number;
}

export interface ColumnDef {
  id: string;
  title: string;
  icon: string;
}

export const COLUMNS: ColumnDef[] = [
  { id: "ideas", title: "Ideas", icon: "📥" },
  { id: "chatgpt-planning", title: "ChatGPT Planning", icon: "🧠" },
  { id: "ready-for-agent", title: "Ready for Agent", icon: "🤖" },
  { id: "under-review", title: "Under Review", icon: "👀" },
  { id: "done", title: "Done", icon: "✅" },
];

const STORAGE_KEY = "agentpm-tasks";

const DEFAULT_TASKS: Task[] = [
  { id: "1", title: "Build Login Screen", description: "Create a clean login UI with email/password fields and social auth options.", contextBoundary: "/src/auth", agentPrompt: "", columnId: "ideas", createdAt: Date.now() },
  { id: "2", title: "User Dashboard", description: "Main dashboard showing key metrics and recent activity after login.", contextBoundary: "/src/dashboard", agentPrompt: "", columnId: "ideas", createdAt: Date.now() },
  { id: "3", title: "Auth Flow Design", description: "Document the complete authentication flow with error handling strategies.", contextBoundary: "/docs/auth-flow", agentPrompt: "", columnId: "chatgpt-planning", createdAt: Date.now() },
  { id: "4", title: "Implement JWT Middleware", description: "Add token verification middleware for protected API routes.", contextBoundary: "/src/middleware", agentPrompt: "", columnId: "ready-for-agent", createdAt: Date.now() },
  { id: "5", title: "Create User Model", description: "Define the database schema for user accounts and profiles.", contextBoundary: "/src/models", agentPrompt: "", columnId: "ready-for-agent", createdAt: Date.now() },
  { id: "6", title: "API Rate Limiting", description: "Review the rate limiting implementation for the public API endpoints.", contextBoundary: "/src/api", agentPrompt: "", columnId: "under-review", createdAt: Date.now() },
  { id: "7", title: "Project Setup", description: "Initialize Next.js project with TypeScript, Tailwind, and ESLint configured.", contextBoundary: "/", agentPrompt: "", columnId: "done", createdAt: Date.now() },
  { id: "8", title: "Environment Config", description: "Set up environment variables and configuration files for all environments.", contextBoundary: "/config", agentPrompt: "", columnId: "done", createdAt: Date.now() },
];

/**
 * Custom hook for managing Kanban state with localStorage persistence.
 */
export function useKanban() {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [isLoaded, setIsLoaded] = React.useState(false);

  // Load from localStorage on mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setTasks(JSON.parse(stored));
      } else {
        setTasks(DEFAULT_TASKS);
      }
    } catch {
      setTasks(DEFAULT_TASKS);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever tasks change
  React.useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }
  }, [tasks, isLoaded]);

  const addTask = React.useCallback((title: string, description: string, contextBoundary: string, agentPrompt: string, columnId: string) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      title,
      description,
      contextBoundary,
      agentPrompt,
      columnId,
      createdAt: Date.now(),
    };
    setTasks((prev) => [...prev, newTask]);
  }, []);

  const moveTask = React.useCallback((taskId: string, newColumnId: string) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, columnId: newColumnId } : t)));
  }, []);

  const deleteTask = React.useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const getTasksByColumn = React.useCallback(
    (columnId: string) => tasks.filter((t) => t.columnId === columnId),
    [tasks]
  );

  return { tasks, isLoaded, addTask, moveTask, deleteTask, getTasksByColumn };
}
