"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import StoryDetailModal from "@/components/features/board/StoryDetailModal";
import SprintBoardHelpTooltip from "@/components/features/board/SprintBoardHelpTooltip";

type Story = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  story_points: number | null;
  business_value: number | null;
  sprint_id: string | null;
};

type Sprint = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  velocity: number | null;
};

type TaskWithAssignee = {
  id: string;
  user_story_id: string;
  title: string;
  description: string | null;
  status: string;
  assignee_id: string | null;
  is_accepted: boolean;
  is_active: boolean;
  estimated_hours: number | null;
  logged_hours: number | null;
  assignee?: { id: string; first_name: string; last_name: string } | null;
};

const PRIORITY_CONFIG: Record<
  string,
  { label: string; pill: string; dot: string }
> = {
  must_have: {
    label: "Must Have",
    pill: "bg-error-light text-error border border-error-border",
    dot: "bg-error",
  },
  should_have: {
    label: "Should Have",
    pill: "bg-accent-light text-accent-text border border-accent-border",
    dot: "bg-accent",
  },
  could_have: {
    label: "Could Have",
    pill: "bg-primary-light text-primary border border-primary-border",
    dot: "bg-primary",
  },
  wont_have: {
    label: "Won't Have",
    pill: "bg-background text-muted border border-border",
    dot: "bg-subtle",
  },
};

const STATUS_CONFIG: Record<
  string,
  { label: string; pill: string; order: number }
> = {
  backlog: {
    label: "Backlog",
    pill: "bg-background text-muted border border-border",
    order: 0,
  },
  in_progress: {
    label: "In Progress",
    pill: "bg-accent-light text-accent-text border border-accent-border",
    order: 1,
  },
  ready: {
    label: "Ready",
    pill: "bg-primary-light text-primary border border-primary-border",
    order: 2,
  },
  done: {
    label: "Done",
    pill: "bg-[rgba(52,211,153,0.12)] text-[#34D399] border border-[rgba(52,211,153,0.25)]",
    order: 3,
  },
};

const PRIORITY_ORDER: Record<string, number> = {
  must_have: 0,
  should_have: 1,
  could_have: 2,
  wont_have: 3,
};

type TaskCategory = "unassigned" | "assigned" | "active" | "done";

function getTaskCategory(task: TaskWithAssignee): TaskCategory {
  if (task.status === "completed") return "done";
  if (task.status === "in_progress") return "active";
  if (task.is_accepted && task.assignee_id) return "assigned";
  return "unassigned";
}

const TASK_CATEGORY_CONFIG: Record<
  TaskCategory,
  { label: string; dot: string; border: string; bg: string }
> = {
  active: {
    label: "Active",
    dot: "bg-accent",
    border: "border-accent-border",
    bg: "bg-accent-light",
  },
  assigned: {
    label: "Assigned",
    dot: "bg-primary",
    border: "border-primary-border",
    bg: "bg-primary-light",
  },
  unassigned: {
    label: "Unassigned",
    dot: "bg-subtle",
    border: "border-border",
    bg: "bg-background",
  },
  done: {
    label: "Done",
    dot: "bg-[#34D399]",
    border: "border-[rgba(52,211,153,0.25)]",
    bg: "bg-[rgba(52,211,153,0.08)]",
  },
};

const CATEGORY_ORDER: TaskCategory[] = [
  "active",
  "assigned",
  "unassigned",
  "done",
];

export default function SprintBoardPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [loading, setLoading] = useState(true);
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [tasksByStory, setTasksByStory] = useState<
    Record<string, TaskWithAssignee[]>
  >({});
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [expandedStories, setExpandedStories] = useState<Set<string>>(
    new Set(),
  );

  const [editingTask, setEditingTask] = useState<TaskWithAssignee | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editHours, setEditHours] = useState("");
  const [editAssigneeId, setEditAssigneeId] = useState("");
  const [editDevelopers, setEditDevelopers] = useState<
    {
      user_id: string;
      role: string;
      user: { first_name: string; last_name: string; email: string } | null;
    }[]
  >([]);
  const [editLoadingMembers, setEditLoadingMembers] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [showHours, setShowHours] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<Record<string, string>>({});

  const fetchTasks = async (storyIds: string[]) => {
    const tasksMap: Record<string, TaskWithAssignee[]> = {};
    await Promise.all(
      storyIds.map(async (storyId) => {
        try {
          const res = await fetch(`/api/stories/${storyId}/tasks`, {
            credentials: "include",
          });
          if (res.ok) tasksMap[storyId] = await res.json();
        } catch {
          /* ignore */
        }
      }),
    );
    setTasksByStory(tasksMap);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [backlogRes, memberRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/backlog`, { credentials: "include" }),
        fetch(`/api/projects/${projectId}/members/me`, {
          credentials: "include",
        }),
      ]);
      if (backlogRes.ok) {
        const data = await backlogRes.json();
        setActiveSprint(data.activeSprint);
        const assigned = data.assigned ?? [];
        setStories(assigned);
        if (assigned.length > 0)
          await fetchTasks(assigned.map((s: Story) => s.id));
      }
      if (memberRes.ok) {
        const d = await memberRes.json();
        if (d.role) setUserRole(d.role);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const toggleExpanded = (storyId: string) => {
    setExpandedStories((prev) => {
      const next = new Set(prev);
      next.has(storyId) ? next.delete(storyId) : next.add(storyId);
      return next;
    });
  };

  const handleMarkReady = async (story: Story) => {
    setActionLoading(story.id);
    setActionError((prev) => ({ ...prev, [story.id]: "" }));
    try {
      const res = await fetch(`/api/stories/${story.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "mark_ready" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError((prev) => ({
          ...prev,
          [story.id]: data.error || "Error marking story as ready.",
        }));
        return;
      }
      await fetchData();
    } catch {
      setActionError((prev) => ({ ...prev, [story.id]: "Server error." }));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnmarkReady = async (story: Story) => {
    setActionLoading(story.id);
    setActionError((prev) => ({ ...prev, [story.id]: "" }));
    try {
      const res = await fetch(`/api/stories/${story.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "unmark_ready" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError((prev) => ({
          ...prev,
          [story.id]: data.error || "Error reverting story.",
        }));
        return;
      }
      await fetchData();
    } catch {
      setActionError((prev) => ({ ...prev, [story.id]: "Server error." }));
    } finally {
      setActionLoading(null);
    }
  };

  const openEdit = async (task: TaskWithAssignee) => {
    setEditDescription(task.description ?? "");
    setEditHours(
      task.estimated_hours != null ? String(task.estimated_hours) : "",
    );
    setEditError(null);
    setEditLoadingMembers(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setEditDevelopers(
          data.filter(
            (m: { role: string }) =>
              m.role === "developer" || m.role === "scrum_master",
          ),
        );
      }
    } catch {
      /* ignore */
    } finally {
      setEditLoadingMembers(false);
    }
    setEditAssigneeId(task.assignee_id ?? "");
    setEditingTask(task);
  };

  const saveEdit = async () => {
    if (!editingTask) return;
    const hours = editHours !== "" ? Number(editHours) : null;
    if (hours !== null && (isNaN(hours) || hours <= 0)) {
      setEditError("Estimated hours must be a positive number.");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "edit",
          description: editDescription.trim() || null,
          estimated_hours: hours,
          assignee_id: editAssigneeId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error ?? "Error saving task.");
        return;
      }
      setEditingTask(null);
      await fetchTasks(stories.map((s) => s.id));
    } catch {
      setEditError("A server error occurred.");
    } finally {
      setEditSaving(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        await fetchTasks(stories.map((s) => s.id));
      } else {
        const data = await res.json();
        alert(data.error || "Error deleting task.");
      }
    } catch {
      alert("Error deleting task.");
    }
  };

  const totalSprintEstimated = Object.values(tasksByStory)
    .flat()
    .reduce((sum, t) => sum + (t.estimated_hours ?? 0), 0);
  const totalSprintLogged = Object.values(tasksByStory)
    .flat()
    .reduce((sum, t) => sum + (t.logged_hours ?? 0), 0);
  const totalSprintRemaining = Math.max(
    0,
    totalSprintEstimated - totalSprintLogged,
  );

  const sorted = [...stories].sort((a, b) => {
    const sd =
      (STATUS_CONFIG[a.status]?.order ?? 99) -
      (STATUS_CONFIG[b.status]?.order ?? 99);
    if (sd !== 0) return sd;
    return (
      (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    );
  });

  const allTasks = Object.values(tasksByStory).flat();
  const taskStats = {
    active: allTasks.filter((t) => getTaskCategory(t) === "active").length,
    assigned: allTasks.filter((t) => getTaskCategory(t) === "assigned").length,
    unassigned: allTasks.filter((t) => getTaskCategory(t) === "unassigned")
      .length,
    done: allTasks.filter((t) => getTaskCategory(t) === "done").length,
  };

  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter(
    (t) => getTaskCategory(t) === "done",
  ).length;
  const doneCount = stories.filter((s) => s.status === "done").length;
  const canAddTasks = userRole === "scrum_master" || userRole === "developer";
  const canMarkReady = userRole === "scrum_master" || userRole === "developer";

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
        <span className="text-sm">Loading Sprint Board...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
          Project
        </p>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-foreground leading-tight">
            Sprint Board
          </h1>
          <SprintBoardHelpTooltip />
        </div>
      </div>

      {activeSprint ? (
        <>
          {/* Sprint info bar */}
          <div className="flex items-center gap-4 p-4 rounded-xl border border-primary-border bg-primary-light mb-6 flex-wrap">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <span className="text-sm font-semibold text-foreground">
                {activeSprint.name}
              </span>
            </div>
            <span className="text-xs text-muted">
              {new Date(activeSprint.start_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
              {" – "}
              {new Date(activeSprint.end_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <div className="ml-auto flex items-center gap-4 text-xs text-muted">
              <span>
                <span className="font-semibold text-foreground">
                  {doneCount}/{stories.length}
                </span>{" "}
                stories done
              </span>
              <span>
                <span className="font-semibold text-foreground">
                  {doneTasks}/{totalTasks}
                </span>{" "}
                tasks done
              </span>
              {activeSprint.velocity && (
                <span>
                  Velocity:{" "}
                  <span className="font-semibold text-foreground">
                    {activeSprint.velocity}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {totalTasks > 0 && (
            <div className="mb-6">
              <div className="flex justify-between items-center text-xs text-muted mb-1.5">
                <div className="flex items-center gap-2">
                  <span>Progress</span>
                  <button
                    onClick={() => setShowHours((v) => !v)}
                    className="px-2 py-0.5 rounded-lg border border-border bg-background text-muted hover:text-foreground hover:border-primary transition-colors text-[10px] font-medium"
                  >
                    {showHours ? "Show % progress" : "Show hours"}
                  </button>
                </div>
                {showHours ? (
                  <span>
                    <span className="text-foreground font-semibold">
                      {totalSprintLogged}h
                    </span>{" "}
                    logged ·{" "}
                    <span className="text-foreground font-semibold">
                      {totalSprintRemaining}h
                    </span>{" "}
                    remaining
                    {totalSprintEstimated > 0 && (
                      <span className="ml-1">
                        / {totalSprintEstimated}h total
                      </span>
                    )}
                  </span>
                ) : (
                  <span>
                    {doneTasks}/{totalTasks} tasks completed (
                    {Math.round((doneTasks / totalTasks) * 100)}%)
                  </span>
                )}
              </div>
              <div className="w-full h-2 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#34D399] transition-all"
                  style={{
                    width: showHours
                      ? totalSprintEstimated > 0
                        ? `${Math.round((totalSprintLogged / totalSprintEstimated) * 100)}%`
                        : "0%"
                      : `${Math.round((doneTasks / totalTasks) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Task summary */}
          {allTasks.length > 0 && (
            <div className="flex items-center gap-4 mb-6 p-3 rounded-lg bg-surface border border-border flex-wrap">
              <span className="text-xs text-muted">Tasks:</span>
              {CATEGORY_ORDER.map((cat) => (
                <span key={cat} className="flex items-center gap-1.5 text-xs">
                  <span
                    className={`w-2 h-2 rounded-full ${TASK_CATEGORY_CONFIG[cat].dot}`}
                  />
                  <span className="text-muted">
                    {TASK_CATEGORY_CONFIG[cat].label}
                  </span>
                  <span className="font-semibold text-foreground">
                    {taskStats[cat]}
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* Story list */}
          {sorted.length > 0 ? (
            <div className="space-y-3">
              {sorted.map((story) => {
                const priority =
                  PRIORITY_CONFIG[story.priority] ?? PRIORITY_CONFIG.wont_have;
                const status =
                  STATUS_CONFIG[story.status] ?? STATUS_CONFIG.backlog;
                const storyTasks = tasksByStory[story.id] ?? [];
                const isExpanded = expandedStories.has(story.id);
                const totalEstimated = storyTasks.reduce(
                  (sum, t) => sum + (t.estimated_hours ?? 0),
                  0,
                );
                const totalLogged = storyTasks.reduce(
                  (sum, t) => sum + (t.logged_hours ?? 0),
                  0,
                );
                const remainingHours = Math.max(
                  0,
                  totalEstimated - totalLogged,
                );

                const groupedTasks: Record<TaskCategory, TaskWithAssignee[]> = {
                  active: storyTasks.filter(
                    (t) => getTaskCategory(t) === "active",
                  ),
                  assigned: storyTasks.filter(
                    (t) => getTaskCategory(t) === "assigned",
                  ),
                  unassigned: storyTasks.filter(
                    (t) => getTaskCategory(t) === "unassigned",
                  ),
                  done: storyTasks.filter((t) => getTaskCategory(t) === "done"),
                };

                const allTasksDone =
                  storyTasks.length === 0 ||
                  storyTasks.every((t) => t.status === "completed");
                // const showMarkReady =
                //   canMarkReady &&
                //   story.status === "in_progress" &&
                //   allTasksDone;
                const isReady = story.status === "ready";
                const showMarkReady =
                  canMarkReady &&
                  story.status === "in_progress" &&
                  allTasksDone;
                const showUnmarkReady = userRole === "scrum_master" && isReady;
                const storyActionError = actionError[story.id];

                return (
                  <div
                    key={story.id}
                    className="rounded-xl border border-border bg-surface overflow-hidden"
                  >
                    <div
                      className="flex items-start gap-3 p-4 cursor-pointer hover:bg-background transition-colors"
                      onClick={() => toggleExpanded(story.id)}
                    >
                      <svg
                        className={`w-4 h-4 text-muted mt-1 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-semibold text-foreground leading-snug">
                            {story.title}
                          </p>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {storyTasks.length > 0 && (
                              <span className="text-xs text-muted bg-background border border-border px-2 py-0.5 rounded-lg">
                                {storyTasks.length} tasks
                              </span>
                            )}
                            {story.story_points != null && (
                              <span className="text-xs text-muted bg-background border border-border px-2 py-0.5 rounded-lg">
                                {story.story_points} pts
                              </span>
                            )}
                            {totalEstimated > 0 && (
                              <span className="text-xs text-muted bg-background border border-border px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <circle cx="12" cy="12" r="9" />
                                  <path strokeLinecap="round" d="M12 7v5l3 3" />
                                </svg>
                                {remainingHours}h left
                              </span>
                            )}

                            {showMarkReady && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkReady(story);
                                }}
                                disabled={actionLoading === story.id}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors bg-primary-light text-primary border border-primary-border hover:bg-primary/20 disabled:opacity-50"
                              >
                                {actionLoading === story.id
                                  ? "..."
                                  : "Mark as ready"}
                              </button>
                            )}
                            {showUnmarkReady && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnmarkReady(story);
                                }}
                                disabled={actionLoading === story.id}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors bg-error-light text-error border border-error-border hover:bg-error/20 disabled:opacity-50"
                              >
                                {actionLoading === story.id
                                  ? "..."
                                  : "Undo ready"}
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStory(story);
                              }}
                              className="ml-1 px-2.5 py-1 text-xs font-semibold text-primary bg-primary-light border border-primary-border rounded-lg hover:bg-primary/20 transition-colors"
                            >
                              Open
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${priority.pill}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${priority.dot}`}
                            />
                            {priority.label}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.pill}`}
                          >
                            {status.label}
                          </span>
                        </div>

                        {storyActionError && (
                          <p className="text-xs text-error mt-1">
                            {storyActionError}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Expanded tasks */}
                    {isExpanded && (
                      <div className="border-t border-border p-4 bg-background">
                        {storyTasks.length > 0 ? (
                          <div className="space-y-4">
                            {CATEGORY_ORDER.map((category) => {
                              const tasks = groupedTasks[category];
                              if (tasks.length === 0) return null;
                              const cfg = TASK_CATEGORY_CONFIG[category];
                              return (
                                <div key={category}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}
                                    />
                                    <span className="text-[10px] font-bold tracking-widest uppercase text-muted">
                                      {cfg.label} ({tasks.length})
                                    </span>
                                  </div>
                                  <div className="space-y-1.5 pl-3">
                                    {tasks.map((task) => (
                                      <div
                                        key={task.id}
                                        className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.border} ${cfg.bg}`}
                                      >
                                        {category === "done" && (
                                          <svg
                                            className="w-4 h-4 text-[#34D399] flex-shrink-0 mt-0.5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              d="M5 13l4 4L19 7"
                                            />
                                          </svg>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <p
                                            className={`text-sm font-medium leading-snug ${category === "done" ? "line-through text-muted" : "text-foreground"}`}
                                          >
                                            {task.description || task.title}
                                          </p>
                                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted flex-wrap">
                                            {task.estimated_hours != null && (
                                              <span className="flex items-center gap-1">
                                                <svg
                                                  className="w-3 h-3"
                                                  fill="none"
                                                  viewBox="0 0 24 24"
                                                  stroke="currentColor"
                                                  strokeWidth={2}
                                                >
                                                  <circle
                                                    cx="12"
                                                    cy="12"
                                                    r="9"
                                                  />
                                                  <path
                                                    strokeLinecap="round"
                                                    d="M12 7v5l3 3"
                                                  />
                                                </svg>
                                                {task.logged_hours ?? 0}h /{" "}
                                                {task.estimated_hours}h
                                              </span>
                                            )}
                                            {task.assignee ? (
                                              <span className="flex items-center gap-1.5">
                                                <span className="w-5 h-5 rounded-full bg-primary-light text-primary border border-primary-border flex items-center justify-center text-[9px] font-bold">
                                                  {
                                                    task.assignee
                                                      .first_name?.[0]
                                                  }
                                                  {task.assignee.last_name?.[0]}
                                                </span>
                                                {task.assignee.first_name}{" "}
                                                {task.assignee.last_name}
                                              </span>
                                            ) : (
                                              <span className="flex items-center gap-1.5 text-subtle">
                                                <span className="w-5 h-5 rounded-full bg-surface border border-border flex items-center justify-center">
                                                  <svg
                                                    className="w-3 h-3"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                  >
                                                    <path
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                                    />
                                                  </svg>
                                                </span>
                                                Unassigned
                                              </span>
                                            )}
                                            {canAddTasks &&
                                              !task.is_accepted &&
                                              task.status !== "completed" &&
                                              !isReady && (
                                                <>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      openEdit(task);
                                                    }}
                                                    className="px-2 py-0.5 text-xs font-semibold rounded-lg transition-colors bg-primary-light text-primary border border-primary-border hover:bg-primary/20"
                                                  >
                                                    Edit
                                                  </button>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      deleteTask(task.id);
                                                    }}
                                                    className="px-2 py-0.5 text-xs font-semibold rounded-lg transition-colors bg-error-light text-error border border-error-border hover:bg-error/20"
                                                  >
                                                    Delete
                                                  </button>
                                                </>
                                              )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-muted text-sm">
                            No tasks yet.
                            {canAddTasks &&
                              story.status !== "done" &&
                              !isReady && (
                                <button
                                  onClick={() => setSelectedStory(story)}
                                  className="ml-2 text-primary hover:text-primary-hover transition-colors font-medium"
                                >
                                  Add task →
                                </button>
                              )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl border border-border bg-surface flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <p className="font-semibold text-foreground mb-1">
                No stories in this sprint
              </p>
              <p className="text-sm text-muted">
                Add stories from the Product Backlog.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl border border-border bg-surface flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="font-semibold text-foreground mb-1">No active sprint</p>
          <p className="text-sm text-muted">
            Start a sprint from the Sprints page to see stories here.
          </p>
        </div>
      )}

      {/* Edit task modal */}
      {editingTask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 backdrop-blur-sm bg-foreground/20"
            onClick={() => setEditingTask(null)}
          />
          <div className="relative w-full max-w-md mx-4 rounded-2xl shadow-2xl bg-surface border border-border">
            <div className="h-1 w-full bg-gradient-to-r from-primary to-accent rounded-t-2xl" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-0.5">
                    Task
                  </p>
                  <h2 className="text-xl font-bold text-foreground">
                    Edit task
                  </h2>
                </div>
                <button
                  onClick={() => setEditingTask(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-lg leading-none bg-background hover:bg-border text-muted transition-colors"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold tracking-widest uppercase text-primary mb-1">
                    Description
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    className="mt-1 block w-full px-3 py-2.5 rounded-lg text-sm bg-background border border-border text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-widest uppercase text-primary mb-1">
                    Estimated hours
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    value={editHours}
                    onChange={(e) => setEditHours(e.target.value)}
                    className="mt-1 block w-full px-3 py-2.5 rounded-lg text-sm bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-widest uppercase text-primary mb-1">
                    Suggested assignee{" "}
                    <span className="normal-case font-normal tracking-normal text-muted">
                      (optional)
                    </span>
                  </label>
                  <select
                    value={editAssigneeId}
                    onChange={(e) => setEditAssigneeId(e.target.value)}
                    className="mt-1 block w-full px-3 py-2.5 rounded-lg text-sm bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  >
                    <option value="">— No assignment —</option>
                    {editLoadingMembers ? (
                      <option disabled>Loading...</option>
                    ) : (
                      editDevelopers.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.user?.first_name} {m.user?.last_name} (
                          {m.user?.email})
                        </option>
                      ))
                    )}
                  </select>
                </div>
                {editError && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-error-border bg-error-light">
                    <svg
                      className="w-4 h-4 text-error mt-0.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                      />
                    </svg>
                    <p className="text-sm text-error">{editError}</p>
                  </div>
                )}
              </div>
              <div className="border-t border-border pt-4 mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setEditingTask(null)}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg transition-colors bg-background hover:bg-border text-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={editSaving}
                  className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 bg-primary hover:bg-primary-hover"
                >
                  {editSaving ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        />
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    "Save changes →"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedStory && (
        <StoryDetailModal
          isOpen={!!selectedStory}
          onClose={() => {
            setSelectedStory(null);
            if (stories.length > 0) fetchTasks(stories.map((s) => s.id));
          }}
          story={selectedStory}
          projectId={projectId}
          canAddTasks={canAddTasks}
        />
      )}
    </div>
  );
}
