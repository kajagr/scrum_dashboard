"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CreateTaskModal from "@/components/features/stories/CreateTaskModal";
import type { Task } from "@/lib/types";

interface StoryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  story: {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    story_points: number | null;
    business_value: number | null;
  };
  projectId: string;
  canAddTasks: boolean;
}

interface TaskWithAssignee extends Task {
  assignee?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

type TaskCategory = "unassigned" | "assigned" | "active" | "done";

const PRIORITY_CONFIG: Record
  string,
  { label: string; pillStyle: React.CSSProperties; dotStyle: React.CSSProperties }
> = {
  must_have: {
    label: "Must Have",
    pillStyle: {
      background: "var(--color-error-light)",
      color: "var(--color-error)",
      border: "2px solid var(--color-error-border)",
    },
    dotStyle: { background: "var(--color-error)" },
  },
  should_have: {
    label: "Should Have",
    pillStyle: {
      background: "var(--color-accent-light)",
      color: "var(--color-accent-text)",
      border: "2px solid var(--color-accent-border)",
    },
    dotStyle: { background: "var(--color-accent)" },
  },
  could_have: {
    label: "Could Have",
    pillStyle: {
      background: "var(--color-primary-light)",
      color: "var(--color-primary)",
      border: "2px solid var(--color-primary-border)",
    },
    dotStyle: { background: "var(--color-primary)" },
  },
  wont_have: {
    label: "Won't Have",
    pillStyle: {
      background: "var(--color-surface)",
      color: "var(--color-muted)",
      border: "2px solid var(--color-border)",
    },
    dotStyle: { background: "var(--color-subtle)" },
  },
};

const STATUS_CONFIG: Record
  string,
  { label: string; pillStyle: React.CSSProperties }
> = {
  backlog: {
    label: "Backlog",
    pillStyle: {
      background: "var(--color-surface)",
      color: "var(--color-muted)",
      border: "2px solid var(--color-border)",
    },
  },
  ready: {
    label: "Ready",
    pillStyle: {
      background: "var(--color-primary-light)",
      color: "var(--color-primary)",
      border: "2px solid var(--color-primary-border)",
    },
  },
  in_progress: {
    label: "In Progress",
    pillStyle: {
      background: "var(--color-accent-light)",
      color: "var(--color-accent-text)",
      border: "2px solid var(--color-accent-border)",
    },
  },
  done: {
    label: "Done",
    pillStyle: {
      background: "color-mix(in srgb, #34D399 12%, transparent)",
      color: "#34D399",
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

const TASK_CATEGORY_CONFIG: Record
  TaskCategory,
  {
    label: string;
    dotStyle: React.CSSProperties;
    containerStyle: React.CSSProperties;
  }
> = {
  unassigned: {
    label: "Unassigned",
    dotStyle: { background: "var(--color-subtle)" },
    containerStyle: {
      background: "var(--color-background)",
      border: "2px solid var(--color-border)",
    },
  },
  assigned: {
    label: "Assigned",
    dotStyle: { background: "var(--color-primary)" },
    containerStyle: {
      background: "var(--color-primary-light)",
      border: "2px solid var(--color-primary-border)",
    },
  },
  active: {
    label: "Active",
    dotStyle: { background: "var(--color-accent)" },
    containerStyle: {
      background: "var(--color-accent-light)",
      border: "2px solid var(--color-accent-border)",
    },
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

export default function StoryDetailModal({
  isOpen,
  onClose,
  story,
  projectId,
  canAddTasks,
}: StoryDetailModalProps) {
  const router = useRouter();

  const [tasks, setTasks] = useState<TaskWithAssignee[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const priority = PRIORITY_CONFIG[story.priority] ?? PRIORITY_CONFIG.should_have;
  const status = STATUS_CONFIG[story.status] ?? STATUS_CONFIG.backlog;

  const fetchTasks = async () => {
    setLoadingTasks(true);
    try {
      const res = await fetch(`/api/stories/${story.id}/tasks`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch {
      console.error("Error loading tasks.");
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTasks();
    }
  }, [isOpen, story.id]);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setCurrentUserId(data.id);
        }
      } catch {
        console.error("Error fetching current user.");
      }
    };

    const fetchCurrentRole = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/members/me`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setCurrentUserRole(data.role);
        }
      } catch {
        console.error("Error fetching current role.");
      }
    };

    fetchCurrentUser();
    fetchCurrentRole();
  }, [projectId]);

  const handleCreateTaskClose = () => {
    setIsCreateTaskOpen(false);
    fetchTasks();
    router.refresh();
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    setUpdatingTaskId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchTasks();
      } else {
        const data = await res.json();
        alert(data.error || "Error updating task.");
      }
    } catch {
      alert("Error updating task.");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const acceptTask = async (taskId: string) => {
    setUpdatingTaskId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "accept" }),
      });
      if (res.ok) {
        await fetchTasks();
      } else {
        const data = await res.json();
        alert(data.error || "Napaka pri sprejemanju naloge.");
      }
    } catch {
      alert("Napaka pri sprejemanju naloge.");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const resignTask = async (taskId: string) => {
    if (!confirm("Ali ste prepričani, da se želite odpovedati tej nalogi?")) return;
    setUpdatingTaskId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "resign" }),
      });
      if (res.ok) {
        await fetchTasks();
      } else {
        const data = await res.json();
        alert(data.error || "Napaka pri odpovedovanju naloge.");
      }
    } catch {
      alert("Napaka pri odpovedovanju naloge.");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  if (!isOpen) return null;

  const totalEstimated = tasks.reduce((sum, t) => sum + (t.estimated_hours ?? 0), 0);
  const totalLogged = tasks.reduce((sum, t) => sum + (t.logged_hours ?? 0), 0);

  const groupedTasks: Record<TaskCategory, TaskWithAssignee[]> = {
    unassigned: tasks.filter((t) => getTaskCategory(t) === "unassigned"),
    assigned:   tasks.filter((t) => getTaskCategory(t) === "assigned"),
    active:     tasks.filter((t) => getTaskCategory(t) === "active"),
    done:       tasks.filter((t) => getTaskCategory(t) === "done"),
  };

  const categoryOrder: TaskCategory[] = ["active", "assigned", "unassigned", "done"];
  const canAccept = currentUserRole === "developer" || currentUserRole === "scrum_master";

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />

        <div
          className="relative m-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl shadow-2xl"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-foreground)",
          }}
        >
          {/* Header */}
          <div className="p-6" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={priority.pillStyle}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={priority.dotStyle} />
                    {priority.label}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={status.pillStyle}
                  >
                    {status.label}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-[var(--color-foreground)]">
                  {story.title}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full transition hover:opacity-90"
                style={{ color: "var(--color-muted)" }}
              >
                ✕
              </button>
            </div>

            <div className="mt-3 flex items-center gap-4 text-sm text-[var(--color-muted)]">
              {story.story_points != null && (
                <span className="flex items-center gap-1">
                  <span className="font-medium text-[var(--color-foreground)]">{story.story_points}</span>
                  story points
                </span>
              )}
              {story.business_value != null && (
                <span className="flex items-center gap-1">
                  BV: <span className="font-medium text-[var(--color-foreground)]">{story.business_value}</span>
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {story.description && (
              <div className="mb-6">
                <h3 className="mb-2 text-sm font-semibold text-[var(--color-foreground)]">Description</h3>
                <p className="text-sm text-[var(--color-muted)]">{story.description}</p>
              </div>
            )}

            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
                    Tasks ({tasks.length})
                  </h3>
                  {tasks.length > 0 && (
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                      {totalLogged}h / {totalEstimated}h completed
                    </p>
                  )}
                </div>
                {canAddTasks && story.status !== "done" && (
                  <button
                    onClick={() => setIsCreateTaskOpen(true)}
                    className="rounded-md px-3 py-1.5 text-sm font-medium transition hover:opacity-90"
                    style={{
                      background: "var(--color-primary)",
                      color: "#ffffff",
                      border: "1px solid var(--color-primary-border)",
                    }}
                  >
                    + Add Task
                  </button>
                )}
              </div>

              {tasks.length > 0 && (
                <div className="mb-4 flex items-center gap-4 text-xs">
                  {categoryOrder.map((cat) => {
                    const config = TASK_CATEGORY_CONFIG[cat];
                    const count = groupedTasks[cat].length;
                    return (
                      <span key={cat} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={config.dotStyle} />
                        <span className="text-[var(--color-muted)]">{config.label}</span>
                        <span className="font-medium text-[var(--color-foreground)]">{count}</span>
                      </span>
                    );
                  })}
                </div>
              )}

              {loadingTasks ? (
                <div className="py-8 text-center text-[var(--color-muted)]">
                  <p className="text-sm">Loading tasks...</p>
                </div>
              ) : tasks.length > 0 ? (
                <div className="space-y-4">
                  {categoryOrder.map((category) => {
                    const categoryTasks = groupedTasks[category];
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
                          {categoryTasks.map((task) => {
                            const isUpdating = updatingTaskId === task.id;
                            const isMyTask = task.assignee_id === currentUserId && task.is_accepted;
                            const isProposedToMe = task.assignee_id === currentUserId && !task.is_accepted;
                            const isUnassigned = !task.assignee_id && !task.is_accepted;

                            return (
                              <div
                                key={task.id}
                                className={`rounded-lg p-3 ${isUpdating ? "opacity-50" : ""}`}
                                style={config.containerStyle}
                              >
                                <div className="flex items-start gap-3">
                                  {/* Checkbox za done */}
                                  <button
                                    onClick={() => updateTaskStatus(task.id, task.status === "completed" ? "assigned" : "completed")}
                                    disabled={isUpdating || !isMyTask}
                                    className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors"
                                    style={
                                      task.status === "completed"
                                        ? { background: "#34D399", borderColor: "#34D399", color: "#ffffff" }
                                        : isMyTask
                                          ? { borderColor: "var(--color-border)", background: "transparent" }
                                          : { borderColor: "var(--color-border)", background: "transparent", opacity: 0.4, cursor: "not-allowed" }
                                    }
                                  >
                                    {task.status === "completed" && (
                                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </button>

                                  <div className="min-w-0 flex-1">
                                    <p
                                      className={`text-sm font-medium ${task.status === "completed" ? "line-through" : ""}`}
                                      style={{ color: task.status === "completed" ? "var(--color-muted)" : "var(--color-foreground)" }}
                                    >
                                      {task.description || task.title}
                                    </p>

                                    <div className="mt-2 flex items-center gap-3 text-xs text-[var(--color-muted)]">
                                      {task.estimated_hours && (
                                        <span>⏱️ {task.logged_hours ?? 0}h / {task.estimated_hours}h</span>
                                      )}
                                      {task.assignee ? (
                                        <span className="flex items-center gap-1">
                                          <span
                                            className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium"
                                            style={{
                                              background: "var(--color-primary-light)",
                                              color: "var(--color-primary)",
                                              border: "1px solid var(--color-primary-border)",
                                            }}
                                          >
                                            {task.assignee.first_name?.[0]}{task.assignee.last_name?.[0]}
                                          </span>
                                          {task.assignee.first_name} {task.assignee.last_name}
                                          {!task.is_accepted && (
                                            <span style={{ color: "var(--color-warning, #F59E0B)", fontSize: "10px" }}>(predlagano)</span>
                                          )}
                                        </span>
                                      ) : (
                                        <span className="flex items-center gap-1" style={{ color: "var(--color-subtle)" }}>
                                          <span
                                            className="flex h-5 w-5 items-center justify-center rounded-full"
                                            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                                          >
                                            <svg className="h-3 w-3" style={{ color: "var(--color-subtle)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                          </span>
                                          Unassigned
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Action buttons */}
                                  <div className="flex flex-shrink-0 items-center gap-1">
                                    {/* Sprejmi */}
                                    {canAccept && !task.is_accepted && (isUnassigned || isProposedToMe) && task.status !== "completed" && (
                                      <button
                                        onClick={() => acceptTask(task.id)}
                                        disabled={isUpdating}
                                        className="rounded px-2 py-1 text-xs font-medium transition hover:opacity-90"
                                        style={{
                                          background: "color-mix(in srgb, #34D399 15%, transparent)",
                                          color: "#34D399",
                                          border: "1px solid color-mix(in srgb, #34D399 30%, transparent)",
                                        }}
                                      >
                                        Sprejmi
                                      </button>
                                    )}

                                    {/* Start */}
                                    {isMyTask && task.status === "assigned" && (
                                      <button
                                        onClick={() => updateTaskStatus(task.id, "in_progress")}
                                        disabled={isUpdating}
                                        className="rounded px-2 py-1 text-xs font-medium transition hover:opacity-90"
                                        style={{
                                          background: "var(--color-accent-light)",
                                          color: "var(--color-accent-text)",
                                          border: "1px solid var(--color-accent-border)",
                                        }}
                                      >
                                        Start
                                      </button>
                                    )}

                                    {/* Pause */}
                                    {isMyTask && task.status === "in_progress" && (
                                      <button
                                        onClick={() => updateTaskStatus(task.id, "assigned")}
                                        disabled={isUpdating}
                                        className="rounded px-2 py-1 text-xs font-medium transition hover:opacity-90"
                                        style={{
                                          background: "var(--color-background)",
                                          color: "var(--color-muted)",
                                          border: "1px solid var(--color-border)",
                                        }}
                                      >
                                        Pause
                                      </button>
                                    )}

                                    {/* Odpovej */}
                                    {isMyTask && task.status !== "completed" && (
                                      <button
                                        onClick={() => resignTask(task.id)}
                                        disabled={isUpdating}
                                        className="rounded px-2 py-1 text-xs font-medium transition hover:opacity-90"
                                        style={{
                                          background: "color-mix(in srgb, #EF4444 10%, transparent)",
                                          color: "#EF4444",
                                          border: "1px solid color-mix(in srgb, #EF4444 25%, transparent)",
                                        }}
                                      >
                                        Odpovej
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  className="rounded-lg py-8 text-center"
                  style={{ background: "var(--color-background)", border: "1px solid var(--color-border)" }}
                >
                  <p className="text-sm text-[var(--color-muted)]">No tasks yet.</p>
                  {canAddTasks && story.status !== "done" && (
                    <button
                      onClick={() => setIsCreateTaskOpen(true)}
                      className="mt-2 text-sm font-medium hover:underline"
                      style={{ color: "var(--color-primary)" }}
                    >
                      Add first task →
                    </button>
                  )}
                </div>
              )}

              {story.status === "done" && (
                <div
                  className="mt-4 rounded-lg p-3"
                  style={{
                    background: "color-mix(in srgb, #F59E0B 10%, var(--color-surface))",
                    border: "1px solid color-mix(in srgb, #F59E0B 25%, transparent)",
                    color: "#F59E0B",
                  }}
                >
                  <p className="text-sm">⚠️ This story is already completed. Tasks cannot be added.</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div
            className="p-4"
            style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-background)" }}
          >
            <button
              onClick={onClose}
              className="w-full rounded-md px-4 py-2 font-medium transition hover:opacity-90"
              style={{
                background: "var(--color-surface)",
                color: "var(--color-foreground)",
                border: "1px solid var(--color-border)",
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={handleCreateTaskClose}
        storyId={story.id}
        projectId={projectId}
      />
    </>
  );
}