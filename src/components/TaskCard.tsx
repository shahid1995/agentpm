"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";

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

export interface TaskCardProps {
  task: Task;
  columns: ColumnDef[];
  onMove: (taskId: string, columnId: string) => void;
  onDelete: (taskId: string) => void;
  onClick: (task: Task) => void;
}

/**
 * A single Kanban card displaying a task with title, description,
 * context boundary badge, and a "Move to..." dropdown.
 */
export function TaskCard({ task, columns, onMove, onDelete, onClick }: TaskCardProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const otherColumns = columns.filter((c) => c.id !== task.columnId);

  return (
    <div
      className="group relative cursor-pointer rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
      onClick={() => onClick(task)}
    >
      <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {task.title}
      </h4>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {task.description}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <Badge variant="outline" className="text-[10px] font-mono">
          {task.contextBoundary}
        </Badge>
        <div className="flex items-center gap-1">
          {/* Move dropdown */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
              className="rounded p-1 text-zinc-400 opacity-0 transition hover:bg-zinc-100 group-hover:opacity-100 dark:hover:bg-zinc-800"
              title="Move to..."
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            {isOpen && (
              <div className="absolute bottom-full right-0 z-10 mb-1 w-40 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                {otherColumns.map((col) => (
                  <button
                    key={col.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(task.id, col.id);
                      setIsOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    <span>{col.icon}</span>
                    <span>{col.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Delete button */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
            className="rounded p-1 text-zinc-400 opacity-0 transition hover:bg-red-100 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-900/30"
            title="Delete task"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
