"use client";

import TaskItem from "./TaskItem";
import type { Task } from "@/lib/types";

interface TaskWithAssignee extends Task {
  assignee?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

type TaskCategory = "unassigned" | "assigned" | "active" | "done";

const TASK_CATEGORY_CONFIG: Record<TaskCategory, {
  label: string;
  dotStyle: React.CSSProperties;
  containerStyle: React.CSSProperties;
}> = {
  unassigned: {
    label: "Unassigned",
    dotStyle: { background: "var(--color-subtle)" },
    containerStyle: { background: "var(--color-background)", border: "2px solid var(--color-border)" },
  },
  assigned: {
    label: "Assigned",
    dotStyle: { background: "var(--color-primary)" },
    containerStyle: { background: "var(--color-primary-light)", border: "2px solid var(--color-primary-border)" },
  },
  active: {
    label: "Active",
    dotStyle: { background: "var(--color-accent)" },
    containerStyle: { background: "var(--color-accent-light)", border: "2px solid var(--color-accent-border)" },
  },
  done: {
    label: "Done",
    dotStyle: { background: "#34D399" },
    containerStyle: {
      background: "color-mix(in srgb, #34D399 10%, var(--color-surface))",
      border: "2px solid color-mix(in srgb, #34D399 25%, transparent)",
    },
  },
};

function getTaskCategory(task: TaskWithAssignee): TaskCategory {
  if (task.status === "completed") return "done";
  if (task.status === "in_progress") return "active";
  if (task.is_accepted && task.assignee_id) return "assigned";
  return "unassigned";
}

interface TaskListProps {
  tasks: TaskWithAssignee[];
  currentUserId: string | null;
  canAccept: boolean;
  updatingTaskId: string | null;
  onAccept: (taskId: string) => void;
  onResign: (taskId: string) => void;
  onUpdateStatus: (taskId: string, status: string) => void;
  onRefresh: () => void;
}

const categoryOrder: TaskCategory[] = ["active", "assigned", "unassigned", "done"];

export default function TaskList({
  tasks,
  currentUserId,
  canAccept,
  updatingTaskId,
  onAccept,
  onResign,
  onUpdateStatus,
  onRefresh,
}: TaskListProps) {
  const grouped: Record<TaskCategory, TaskWithAssignee[]> = {
    unassigned: tasks.filter((t) => getTaskCategory(t) === "unassigned"),
    assigned:   tasks.filter((t) => getTaskCategory(t) === "assigned"),
    active:     tasks.filter((t) => getTaskCategory(t) === "active"),
    done:       tasks.filter((t) => getTaskCategory(t) === "done"),
  };

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        {categoryOrder.map((cat) => {
          const config = TASK_CATEGORY_CONFIG[cat];
          return (
            <span key={cat} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={config.dotStyle} />
              <span className="text-[var(--color-muted)]">{config.label}</span>
              <span className="font-medium text-[var(--color-foreground)]">{grouped[cat].length}</span>
            </span>
          );
        })}
      </div>

      {/* Grouped tasks */}
      {categoryOrder.map((category) => {
        const categoryTasks = grouped[category];
        if (categoryTasks.length === 0) return null;
        const config = TASK_CATEGORY_CONFIG[category];

        return (
          <div key={category}>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={config.dotStyle} />
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                {config.label} ({categoryTasks.length})
              </span>
            </div>
            <div className="space-y-2">
              {categoryTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  currentUserId={currentUserId}
                  canAccept={canAccept}
                  isUpdating={updatingTaskId === task.id}
                  containerStyle={config.containerStyle}
                  onAccept={onAccept}
                  onResign={onResign}
                  onUpdateStatus={onUpdateStatus}
                  onRefresh={onRefresh}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}