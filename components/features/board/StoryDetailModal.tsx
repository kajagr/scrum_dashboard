"use client";

import { useState, useEffect } from "react";
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

const PRIORITY_CONFIG: Record<string, { label: string; pill: string; dot: string }> = {
  must_have:   { label: "Must Have",   pill: "bg-error-light text-error border border-error-border",         dot: "bg-error" },
  should_have: { label: "Should Have", pill: "bg-accent-light text-accent-text border border-accent-border", dot: "bg-accent" },
  could_have:  { label: "Could Have",  pill: "bg-primary-light text-primary border border-primary-border",   dot: "bg-primary" },
  wont_have:   { label: "Won't Have",  pill: "bg-background text-muted border border-border",                dot: "bg-subtle" },
};

const STATUS_CONFIG: Record<string, { label: string; pill: string }> = {
  backlog:     { label: "Backlog",     pill: "bg-background text-muted border border-border" },
  ready:       { label: "Ready",       pill: "bg-primary-light text-primary border border-primary-border" },
  in_progress: { label: "In Progress", pill: "bg-accent-light text-accent-text border border-accent-border" },
  done:        { label: "Done",        pill: "bg-[rgba(52,211,153,0.12)] text-[#34D399] border border-[rgba(52,211,153,0.25)]" },
};

type TaskCategory = "unassigned" | "assigned" | "active" | "done";

function getTaskCategory(task: TaskWithAssignee): TaskCategory {
  if (task.status === "completed") return "done";
  if (task.status === "in_progress") return "active";
  if (task.is_accepted && task.assignee_id) return "assigned";
  return "unassigned";
}

const TASK_CATEGORY_CONFIG: Record<TaskCategory, { label: string; dot: string }> = {
  active:     { label: "Active",     dot: "bg-accent" },
  assigned:   { label: "Assigned",   dot: "bg-primary" },
  unassigned: { label: "Unassigned", dot: "bg-subtle" },
  done:       { label: "Done",       dot: "bg-[#34D399]" },
};

const categoryOrder: TaskCategory[] = ["active", "assigned", "unassigned", "done"];

function UserAvatar({ firstName, lastName }: { firstName?: string; lastName?: string }) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
  return (
    <span className="w-5 h-5 rounded-full bg-primary-light text-primary border border-primary-border flex items-center justify-center text-[9px] font-bold flex-shrink-0">
      {initials}
    </span>
  );
}

export default function StoryDetailModal({
  isOpen,
  onClose,
  story,
  projectId,
  canAddTasks,
}: StoryDetailModalProps) {
  const [tasks, setTasks] = useState<TaskWithAssignee[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [resignConfirmId, setResignConfirmId] = useState<string | null>(null);

  const priority = PRIORITY_CONFIG[story.priority] ?? PRIORITY_CONFIG.should_have;
  const status = STATUS_CONFIG[story.status] ?? STATUS_CONFIG.backlog;

  const fetchTasks = async () => {
    setLoadingTasks(true);
    try {
      const res = await fetch(`/api/stories/${story.id}/tasks`, { credentials: "include" });
      if (res.ok) setTasks(await res.json());
    } catch {
      console.error("Error loading tasks.");
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchTasks();
  }, [isOpen, story.id]);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.id) setCurrentUserId(d.id); })
      .catch(() => {});
    fetch(`/api/projects/${projectId}/members/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.role) setCurrentUserRole(d.role); })
      .catch(() => {});
  }, [projectId]);

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    setUpdatingTaskId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) await fetchTasks();
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
      if (res.ok) await fetchTasks();
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const resignTask = async (taskId: string) => {
    setUpdatingTaskId(taskId);
    setResignConfirmId(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "resign" }),
      });
      if (res.ok) await fetchTasks();
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

  const canAccept = currentUserRole === "developer" || currentUserRole === "scrum_master";

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 backdrop-blur-sm bg-foreground/20" onClick={onClose} />

        <div className="relative w-full max-w-2xl mx-4 rounded-2xl overflow-hidden shadow-2xl bg-surface border border-border max-h-[90vh] flex flex-col">
          {/* Top accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-primary to-accent flex-shrink-0" />

          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${priority.pill}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
                    {priority.label}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${status.pill}`}>
                    {status.label}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-foreground leading-snug">{story.title}</h2>
                <div className="flex items-center gap-3 mt-2">
                  {story.story_points != null && (
                    <span className="text-xs text-muted bg-background border border-border px-2 py-0.5 rounded-lg">
                      {story.story_points} story points
                    </span>
                  )}
                  {story.business_value != null && (
                    <span className="text-xs text-muted bg-background border border-border px-2 py-0.5 rounded-lg">
                      BV {story.business_value}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full text-lg leading-none transition-colors bg-background hover:bg-border text-muted flex-shrink-0"
              >
                ×
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {story.description && (
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-2">Description</p>
                <p className="text-sm text-muted leading-relaxed">{story.description}</p>
              </div>
            )}

            {/* Tasks section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold tracking-widest uppercase text-primary">
                    Tasks {tasks.length > 0 && `(${tasks.length})`}
                  </p>
                  {tasks.length > 0 && (
                    <p className="text-xs text-muted mt-0.5">{totalLogged}h / {totalEstimated}h completed</p>
                  )}
                </div>
                {canAddTasks && story.status !== "done" && (
                  <button
                    onClick={() => setIsCreateTaskOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors bg-primary hover:bg-primary-hover"
                  >
                    <span className="text-sm leading-none">+</span>
                    Add Task
                  </button>
                )}
              </div>

              {/* Category legend */}
              {tasks.length > 0 && (
                <div className="flex items-center gap-4 mb-4 flex-wrap">
                  {categoryOrder.map((cat) => {
                    const config = TASK_CATEGORY_CONFIG[cat];
                    const count = groupedTasks[cat].length;
                    return (
                      <span key={cat} className="flex items-center gap-1.5 text-xs">
                        <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                        <span className="text-muted">{config.label}</span>
                        <span className="font-semibold text-foreground">{count}</span>
                      </span>
                    );
                  })}
                </div>
              )}

              {loadingTasks ? (
                <div className="flex items-center gap-2 py-8 justify-center text-muted">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span className="text-sm">Loading tasks...</span>
                </div>
              ) : tasks.length > 0 ? (
                <div className="space-y-4">
                  {categoryOrder.map((category) => {
                    const categoryTasks = groupedTasks[category];
                    if (categoryTasks.length === 0) return null;
                    const config = TASK_CATEGORY_CONFIG[category];

                    return (
                      <div key={category}>
                        {/* Section header */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                          <span className="text-[10px] font-bold tracking-widest uppercase text-muted">
                            {config.label} ({categoryTasks.length})
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {categoryTasks.map((task) => {
                            const isUpdating = updatingTaskId === task.id;
                            const isMyTask = task.assignee_id === currentUserId && task.is_accepted;
                            const isProposedToMe = task.assignee_id === currentUserId && !task.is_accepted;
                            const isUnassigned = !task.assignee_id && !task.is_accepted;
                            const isDone = task.status === "completed";
                            const isResignConfirm = resignConfirmId === task.id;

                            return (
                              <div
                                key={task.id}
                                className={`group flex items-start gap-3 p-3 rounded-xl border transition-all
                                  ${isUpdating ? "opacity-50" : ""}
                                  ${isDone
                                    ? "bg-background border-border"
                                    : isMyTask
                                      ? "bg-primary-light border-primary-border"
                                      : "bg-background border-border hover:border-subtle"
                                  }`}
                              >
                                {/* Checkbox */}
                                <button
                                  onClick={() => updateTaskStatus(task.id, isDone ? "assigned" : "completed")}
                                  disabled={isUpdating || !isMyTask}
                                  className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                                    ${isDone
                                      ? "bg-[#34D399] border-[#34D399] text-white"
                                      : isMyTask
                                        ? "border-primary hover:border-[#34D399]"
                                        : "border-subtle opacity-40 cursor-not-allowed"
                                    }`}
                                >
                                  {isDone && (
                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium leading-snug ${isDone ? "text-muted line-through" : "text-foreground"}`}>
                                    {task.description || task.title}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                    {task.estimated_hours != null && (
                                      <span className="flex items-center gap-1 text-xs text-muted">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 7v5l3 3" />
                                        </svg>
                                        {task.logged_hours ?? 0}h / {task.estimated_hours}h
                                      </span>
                                    )}
                                    {task.assignee ? (
                                      <span className="flex items-center gap-1.5 text-xs text-muted">
                                        <UserAvatar firstName={task.assignee.first_name} lastName={task.assignee.last_name} />
                                        {task.assignee.first_name} {task.assignee.last_name}
                                        {!task.is_accepted && (
                                          <span className="text-[10px] text-accent-text font-medium">(proposed)</span>
                                        )}
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1.5 text-xs text-muted">
                                        <span className="w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center">
                                          <svg className="w-3 h-3 text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                          </svg>
                                        </span>
                                        Unassigned
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Action buttons */}
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {/* Accept */}
                                  {canAccept && !task.is_accepted && (isUnassigned || isProposedToMe) && !isDone && (
                                    <button
                                      onClick={() => acceptTask(task.id)}
                                      disabled={isUpdating}
                                      className="px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors bg-[rgba(52,211,153,0.12)] text-[#34D399] border border-[rgba(52,211,153,0.25)] hover:bg-[rgba(52,211,153,0.2)] disabled:opacity-50"
                                    >
                                      Accept
                                    </button>
                                  )}

                                  {/* Start */}
                                  {isMyTask && task.status === "assigned" && (
                                    <button
                                      onClick={() => updateTaskStatus(task.id, "in_progress")}
                                      disabled={isUpdating}
                                      className="px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors bg-accent-light text-accent-text border border-accent-border hover:bg-accent/20 disabled:opacity-50"
                                    >
                                      Start
                                    </button>
                                  )}

                                  {/* Pause */}
                                  {isMyTask && task.status === "in_progress" && (
                                    <button
                                      onClick={() => updateTaskStatus(task.id, "assigned")}
                                      disabled={isUpdating}
                                      className="px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors bg-background text-muted border border-border hover:border-subtle hover:text-foreground disabled:opacity-50"
                                    >
                                      Pause
                                    </button>
                                  )}

                                  {/* Resign — with inline confirm */}
                                  {isMyTask && !isDone && (
                                    isResignConfirm ? (
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => resignTask(task.id)}
                                          disabled={isUpdating}
                                          className="px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors bg-error-light text-error border border-error-border hover:bg-error/20 disabled:opacity-50"
                                        >
                                          Confirm
                                        </button>
                                        <button
                                          onClick={() => setResignConfirmId(null)}
                                          className="px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors bg-background text-muted border border-border hover:border-subtle"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => setResignConfirmId(task.id)}
                                        className="px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors bg-background text-muted border border-border hover:border-error-border hover:text-error disabled:opacity-50"
                                      >
                                        Resign
                                      </button>
                                    )
                                  )}
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
                <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-border bg-background text-center">
                  <div className="w-10 h-10 rounded-xl border border-border bg-surface flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-foreground mb-0.5">No tasks yet</p>
                  <p className="text-xs text-muted mb-3">Break this story into smaller tasks</p>
                  {canAddTasks && story.status !== "done" && (
                    <button
                      onClick={() => setIsCreateTaskOpen(true)}
                      className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
                    >
                      Add first task →
                    </button>
                  )}
                </div>
              )}

              {story.status === "done" && (
                <div className="mt-4 flex items-center gap-2.5 p-3 rounded-xl border border-[rgba(52,211,153,0.25)] bg-[rgba(52,211,153,0.08)]">
                  <svg className="w-4 h-4 text-[#34D399] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-[#34D399] font-medium">This story is completed. No new tasks can be added.</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex-shrink-0">
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 text-sm font-medium rounded-xl transition-colors bg-background hover:bg-border text-muted"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => { setIsCreateTaskOpen(false); fetchTasks(); }}
        storyId={story.id}
        projectId={projectId}
      />
    </>
  );
}