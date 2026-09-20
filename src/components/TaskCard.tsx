import { Badge } from "@/components/ui/badge";

export interface TaskCardProps {
  title: string;
  description: string;
  contextBoundary: string;
}

/**
 * A single Kanban card displaying a task with title, description,
 * and a "Context Boundary" badge (e.g. /src/auth).
 */
export function TaskCard({ title, description, contextBoundary }: TaskCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h4>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
      <div className="mt-3">
        <Badge variant="outline" className="text-[10px] font-mono">
          {contextBoundary}
        </Badge>
      </div>
    </div>
  );
}
