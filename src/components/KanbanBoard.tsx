"use client";

import * as React from "react";
import { TaskCard, type Task, type ColumnDef } from "./TaskCard";

export interface KanbanBoardProps {
  columns: ColumnDef[];
  getTasksByColumn: (columnId: string) => Task[];
  onMove: (taskId: string, columnId: string) => void;
  onDelete: (taskId: string) => void;
  onAddTask: (columnId: string) => void;
  onCardClick: (task: Task) => void;
}

/**
 * KanbanBoard renders a horizontal list of columns, each containing
 * a stack of TaskCard components.
 */
export function KanbanBoard({ columns, getTasksByColumn, onMove, onDelete, onAddTask, onCardClick }: KanbanBoardProps) {
  return (
    <div className="flex gap-4 overflow-x-auto p-6">
      {columns.map((col) => {
        const tasks = getTasksByColumn(col.id);
        return (
          <div
            key={col.id}
            className="flex min-w-[260px] flex-col rounded-xl border border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            {/* Column header */}
            <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <span className="text-lg">{col.icon}</span>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {col.title}
              </h3>
              <span className="ml-auto rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {tasks.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-3 p-3">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  columns={columns}
                  onMove={onMove}
                  onDelete={onDelete}
                  onClick={onCardClick}
                />
              ))}
              {/* Add Task button */}
              <button
                onClick={() => onAddTask(col.id)}
                className="flex items-center justify-center gap-1 rounded-lg border-2 border-dashed border-zinc-300 py-3 text-xs font-medium text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-500 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                Add Task
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
