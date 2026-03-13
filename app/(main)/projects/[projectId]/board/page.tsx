"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import StoryDetailModal from "@/components/features/board/StoryDetailModal";

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

type ProjectMember = {
  role: string;
};

type TaskWithAssignee = {
  id: string;
  user_story_id: string;
  title: string;
  description: string | null;
  status: string;
  assignee_id: string | null;
  is_accepted: boolean;
  estimated_hours: number | null;
  logged_hours: number | null;
  assignee?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
};

const PRIORITY_CONFIG: Record<
  string,
  { label: string; style: React.CSSProperties; dotStyle: React.CSSProperties }
> = {
  must_have: {
    label: "Must Have",
    style: {
      background: "var(--color-error-light)",
      color: "var(--color-error)",
      border: "1px solid var(--color-error-border)",
    },
    dotStyle: { background: "var(--color-error)" },
  },
  should_have: {
    label: "Should Have",
    style: {
      background: "var(--color-accent-light)",
      color: "var(--color-accent-text)",
      border: "1px solid var(--color-accent-border)",
    },
    dotStyle: { background: "var(--color-accent)" },
  },
  could_have: {
    label: "Could Have",
    style: {
      background: "var(--color-primary-light)",
      color: "var(--color-primary)",
      border: "1px solid var(--color-primary-border)",
    },
    dotStyle: { background: "var(--color-primary)" },
  },
  wont_have: {
    label: "Won't Have",
    style: {
      background: "color-mix(in srgb, var(--color-muted) 12%, transparent)",
      color: "var(--color-muted)",
      border:
        "1px solid color-mix(in srgb, var(--color-muted) 25%, transparent)",
    },
    dotStyle: { background: "var(--color-muted)" },
  },
};

const STATUS_CONFIG: Record<
  string,
  { label: string; style: React.CSSProperties; order: number }
> = {
  backlog: {
    label: "Backlog",
    style: {
      background: "color-mix(in srgb, var(--color-muted) 12%, transparent)",
      color: "var(--color-muted)",
      border:
        "1px solid color-mix(in srgb, var(--color-muted) 25%, transparent)",
    },
    order: 0,
  },
  ready: {
    label: "Ready",
    style: {
      background: "var(--color-primary-light)",
      color: "var(--color-primary)",
      border: "1px solid var(--color-primary-border)",
    },
    order: 1,
  },
  in_progress: {
    label: "In Progress",
    style: {
      background: "var(--color-accent-light)",
      color: "var(--color-accent-text)",
      border: "1px solid var(--color-accent-border)",
    },
    order: 2,
  },
  done: {
    label: "Done",
    style: {
      background: "color-mix(in srgb, #34D399 12%, transparent)",
      color: "#34D399",
      border: "1px solid color-mix(in srgb, #34D399 25%, transparent)",
    },
    order: 3,
  },
};

const PRIORITY_ORDER: Record<string, number> = {
  must_have: 0,
  should_have: 1,
  could_have: 2,
  wont_have: 3,
};

function getTaskCategory(
  task: TaskWithAssignee,
): "unassigned" | "assigned" | "active" | "done" {
  if (task.status === "completed") return "done";
  if (task.status === "in_progress") return "active";
  if (task.assignee_id) return "assigned";
  return "unassigned";
}

const TASK_CATEGORY_CONFIG: Record<
  "unassigned" | "assigned" | "active" | "done",
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
      border: "1px solid var(--color-border)",
    },
  },
  assigned: {
    label: "Assigned",
    dotStyle: { background: "var(--color-primary)" },
    containerStyle: {
      background: "var(--color-primary-light)",
      border: "1px solid var(--color-primary-border)",
    },
  },
  active: {
    label: "Active",
    dotStyle: { background: "var(--color-accent)" },
    containerStyle: {
      background: "var(--color-accent-light)",
      border: "1px solid var(--color-accent-border)",
    },
  },
  done: {
    label: "Done",
    dotStyle: { background: "#34D399" },
    containerStyle: {
      background: "color-mix(in srgb, #34D399 10%, var(--color-surface))",
      border: "1px solid color-mix(in srgb, #34D399 25%, transparent)",
    },
  },
};

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
          console.error(`Error fetching tasks for story ${storyId}`);
        }
      }),
    );
    setTasksByStory(tasksMap);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const backlogRes = await fetch(`/api/projects/${projectId}/backlog`, {
          credentials: "include",
        });
        if (backlogRes.ok) {
          const data = await backlogRes.json();
          setActiveSprint(data.activeSprint);
          const assignedStories = data.assigned ?? [];
          setStories(assignedStories);
          if (assignedStories.length > 0) {
            await fetchTasks(assignedStories.map((s: Story) => s.id));
          }
        }

        const memberRes = await fetch(`/api/projects/${projectId}/members/me`, {
          credentials: "include",
        });
        if (memberRes.ok) {
          const memberData: ProjectMember = await memberRes.json();
          setUserRole(memberData.role);
        }
      } catch {
        console.error("Error loading sprint board");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId]);

  const toggleExpanded = (storyId: string) => {
    setExpandedStories((prev) => {
      const next = new Set(prev);
      if (next.has(storyId)) next.delete(storyId);
      else next.add(storyId);
      return next;
    });
  };

  const openEdit = async (task: TaskWithAssignee) => {
    setEditDescription(task.description ?? "");
    setEditHours(
      task.estimated_hours != null ? String(task.estimated_hours) : "",
    );
    setEditError(null);
    // ✅ Najprej naloži developers, šele nato nastavi task in assigneeId
    try {
      setEditLoadingMembers(true);
      const res = await fetch(`/api/projects/${projectId}/members`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const assignable = data.filter(
          (m: { role: string }) =>
            m.role === "developer" || m.role === "scrum_master",
        );
        setEditDevelopers(assignable);
      }
    } catch {
      /* nič */
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
      setEditError("Ocena časa mora biti pozitivno število.");
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
        setEditError(data.error ?? "Napaka pri shranjevanju.");
        return;
      }
      setEditingTask(null);
      await fetchTasks(stories.map((s) => s.id));
    } catch {
      setEditError("Napaka pri shranjevanju.");
    } finally {
      setEditSaving(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm("Ali ste prepričani, da želite izbrisati to nalogo?")) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        await fetchTasks(stories.map((s) => s.id));
      } else {
        const data = await res.json();
        alert(data.error || "Napaka pri brisanju naloge.");
      }
    } catch {
      alert("Napaka pri brisanju naloge.");
    }
  };

  const sorted = [...stories].sort((a, b) => {
    const statusDiff =
      (STATUS_CONFIG[a.status]?.order ?? 99) -
      (STATUS_CONFIG[b.status]?.order ?? 99);
    if (statusDiff !== 0) return statusDiff;
    return (
      (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
    );
  });

  const totalPoints = stories.reduce(
    (sum, s) => sum + (s.story_points ?? 0),
    0,
  );
  const donePoints = stories
    .filter((s) => s.status === "done")
    .reduce((sum, s) => sum + (s.story_points ?? 0), 0);
  const doneCount = stories.filter((s) => s.status === "done").length;

  const canAddTasks = userRole === "scrum_master" || userRole === "developer";

  const allTasks = Object.values(tasksByStory).flat();
  const taskStats = {
    unassigned: allTasks.filter((t) => getTaskCategory(t) === "unassigned")
      .length,
    assigned: allTasks.filter((t) => getTaskCategory(t) === "assigned").length,
    active: allTasks.filter((t) => getTaskCategory(t) === "active").length,
    done: allTasks.filter((t) => getTaskCategory(t) === "done").length,
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-[var(--color-muted)]">
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
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
    <div className="p-6 text-[var(--color-foreground)]">
      <div className="mb-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
          Project
        </p>
        <h1 className="text-3xl font-bold leading-tight">Sprint Board</h1>
      </div>

      {activeSprint ? (
        <>
          <div
            className="mb-6 flex flex-wrap items-center gap-4 rounded-xl p-4"
            style={{
              border: "1px solid var(--color-primary-border)",
              background: "var(--color-primary-light)",
            }}
          >
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4"
                style={{ color: "var(--color-primary)" }}
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
              <span className="text-sm font-semibold text-[var(--color-foreground)]">
                {activeSprint.name}
              </span>
            </div>

            <span className="text-xs text-[var(--color-muted)]">
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

            <div className="ml-auto flex items-center gap-4 text-xs text-[var(--color-muted)]">
              <span>
                <span className="font-semibold text-[var(--color-foreground)]">
                  {doneCount}/{stories.length}
                </span>{" "}
                stories done
              </span>
              <span>
                <span className="font-semibold text-[var(--color-foreground)]">
                  {donePoints}/{totalPoints}
                </span>{" "}
                pts completed
              </span>
              {activeSprint.velocity && (
                <span>
                  Velocity:{" "}
                  <span className="font-semibold text-[var(--color-foreground)]">
                    {activeSprint.velocity}
                  </span>
                </span>
              )}
            </div>
          </div>

          {totalPoints > 0 && (
            <div className="mb-6">
              <div className="mb-1.5 flex justify-between text-xs text-[var(--color-muted)]">
                <span>Progress</span>
                <span>{Math.round((donePoints / totalPoints) * 100)}%</span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full"
                style={{ background: "var(--color-border)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.round((donePoints / totalPoints) * 100)}%`,
                    background: "#34D399",
                  }}
                />
              </div>
            </div>
          )}

          {allTasks.length > 0 && (
            <div
              className="mb-6 flex items-center gap-3 rounded-lg p-3"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <span className="text-xs text-[var(--color-muted)]">Tasks:</span>
              <div className="flex items-center gap-2">
                {(["unassigned", "assigned", "active", "done"] as const).map(
                  (cat) => (
                    <span
                      key={cat}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={TASK_CATEGORY_CONFIG[cat].dotStyle}
                      />
                      <span className="text-[var(--color-muted)]">
                        {TASK_CATEGORY_CONFIG[cat].label}
                      </span>
                      <span className="font-semibold text-[var(--color-foreground)]">
                        {taskStats[cat]}
                      </span>
                    </span>
                  ),
                )}
              </div>
            </div>
          )}

          {sorted.length > 0 ? (
            <div className="space-y-3">
              {sorted.map((story) => {
                const priority =
                  PRIORITY_CONFIG[story.priority] ?? PRIORITY_CONFIG.wont_have;
                const status =
                  STATUS_CONFIG[story.status] ?? STATUS_CONFIG.backlog;
                const storyTasks = tasksByStory[story.id] ?? [];
                const isExpanded = expandedStories.has(story.id);

                const groupedTasks = {
                  unassigned: storyTasks.filter(
                    (t) => getTaskCategory(t) === "unassigned",
                  ),
                  assigned: storyTasks.filter(
                    (t) => getTaskCategory(t) === "assigned",
                  ),
                  active: storyTasks.filter(
                    (t) => getTaskCategory(t) === "active",
                  ),
                  done: storyTasks.filter((t) => getTaskCategory(t) === "done"),
                };

                return (
                  <div
                    key={story.id}
                    className="overflow-hidden rounded-xl"
                    style={{
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                    }}
                  >
                    <div
                      className="flex cursor-pointer items-start gap-3 p-4 transition hover:opacity-95"
                      onClick={() => toggleExpanded(story.id)}
                    >
                      <svg
                        className={`mt-1 h-4 w-4 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        style={{ color: "var(--color-muted)" }}
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

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-snug text-[var(--color-foreground)]">
                            {story.title}
                          </p>
                          <div className="flex flex-shrink-0 items-center gap-1.5">
                            {storyTasks.length > 0 && (
                              <span
                                className="rounded-lg px-2 py-0.5 text-xs"
                                style={{
                                  color: "var(--color-muted)",
                                  background: "var(--color-background)",
                                  border: "1px solid var(--color-border)",
                                }}
                              >
                                {storyTasks.length} tasks
                              </span>
                            )}
                            {story.story_points != null && (
                              <span
                                className="rounded-lg px-2 py-0.5 text-xs"
                                style={{
                                  color: "var(--color-muted)",
                                  background: "var(--color-background)",
                                  border: "1px solid var(--color-border)",
                                }}
                              >
                                {story.story_points} pts
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                            style={priority.style}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={priority.dotStyle}
                            />
                            {priority.label}
                          </span>
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-medium"
                            style={status.style}
                          >
                            {status.label}
                          </span>
                          {storyTasks.length > 0 && (
                            <div className="ml-2 flex items-center gap-1">
                              {groupedTasks.active.length > 0 && (
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={TASK_CATEGORY_CONFIG.active.dotStyle}
                                  title={`${groupedTasks.active.length} active`}
                                />
                              )}
                              {groupedTasks.assigned.length > 0 && (
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={TASK_CATEGORY_CONFIG.assigned.dotStyle}
                                  title={`${groupedTasks.assigned.length} assigned`}
                                />
                              )}
                              {groupedTasks.unassigned.length > 0 && (
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={
                                    TASK_CATEGORY_CONFIG.unassigned.dotStyle
                                  }
                                  title={`${groupedTasks.unassigned.length} unassigned`}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStory(story);
                        }}
                        className="rounded px-2 py-1 text-xs transition hover:opacity-80"
                        style={{ color: "var(--color-primary)" }}
                      >
                        Open
                      </button>
                    </div>

                    {isExpanded && (
                      <div
                        className="border-t p-4"
                        style={{
                          borderColor: "var(--color-border)",
                          background: "var(--color-background)",
                        }}
                      >
                        {storyTasks.length > 0 ? (
                          <div className="space-y-4">
                            {(
                              [
                                "active",
                                "assigned",
                                "unassigned",
                                "done",
                              ] as const
                            ).map((category) => {
                              const tasks = groupedTasks[category];
                              if (tasks.length === 0) return null;
                              const config = TASK_CATEGORY_CONFIG[category];

                              return (
                                <div key={category}>
                                  <div className="mb-2 flex items-center gap-2">
                                    <span
                                      className="h-2 w-2 rounded-full"
                                      style={config.dotStyle}
                                    />
                                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                                      {config.label} ({tasks.length})
                                    </span>
                                  </div>

                                  <div className="space-y-2 pl-4">
                                    {tasks.map((task) => (
                                      <div
                                        key={task.id}
                                        className="rounded-lg p-3"
                                        style={config.containerStyle}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                              {category === "done" && (
                                                <svg
                                                  className="h-4 w-4 flex-shrink-0"
                                                  style={{ color: "#34D399" }}
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
                                              <p className="text-sm font-medium text-[var(--color-foreground)]">
                                                {task.description || task.title}
                                              </p>
                                            </div>

                                            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-[var(--color-muted)]">
                                              {task.estimated_hours && (
                                                <span>
                                                  ⏱️ {task.logged_hours ?? 0}h /{" "}
                                                  {task.estimated_hours}h
                                                </span>
                                              )}

                                              {task.assignee ? (
                                                <span className="flex items-center gap-1">
                                                  <span
                                                    className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium"
                                                    style={{
                                                      background:
                                                        "var(--color-primary-light)",
                                                      color:
                                                        "var(--color-primary)",
                                                      border:
                                                        "1px solid var(--color-primary-border)",
                                                    }}
                                                  >
                                                    {
                                                      task.assignee
                                                        .first_name?.[0]
                                                    }
                                                    {
                                                      task.assignee
                                                        .last_name?.[0]
                                                    }
                                                  </span>
                                                  {task.assignee.first_name}{" "}
                                                  {task.assignee.last_name}
                                                </span>
                                              ) : (
                                                <span className="flex items-center gap-1 text-[var(--color-subtle)]">
                                                  <span
                                                    className="flex h-5 w-5 items-center justify-center rounded-full"
                                                    style={{
                                                      background:
                                                        "var(--color-surface)",
                                                      border:
                                                        "1px solid var(--color-border)",
                                                    }}
                                                  >
                                                    <svg
                                                      className="h-3 w-3"
                                                      style={{
                                                        color:
                                                          "var(--color-subtle)",
                                                      }}
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

                                              {/* ✅ Edit/Delete: samo za !is_accepted in ne completed */}
                                              {canAddTasks &&
                                                !task.is_accepted &&
                                                task.status !== "completed" && (
                                                  <>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        openEdit(task);
                                                      }}
                                                      className="rounded px-2 py-0.5 text-xs font-medium transition hover:opacity-90"
                                                      style={{
                                                        background:
                                                          "var(--color-primary-light)",
                                                        color:
                                                          "var(--color-primary)",
                                                        border:
                                                          "1px solid var(--color-primary-border)",
                                                      }}
                                                    >
                                                      Uredi
                                                    </button>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteTask(task.id);
                                                      }}
                                                      className="rounded px-2 py-0.5 text-xs font-medium transition hover:opacity-90"
                                                      style={{
                                                        background:
                                                          "color-mix(in srgb, #EF4444 10%, transparent)",
                                                        color: "#EF4444",
                                                        border:
                                                          "1px solid color-mix(in srgb, #EF4444 25%, transparent)",
                                                      }}
                                                    >
                                                      Izbriši
                                                    </button>
                                                  </>
                                                )}
                                            </div>
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
                          <div className="py-4 text-center text-sm text-[var(--color-muted)]">
                            No tasks yet.
                            {canAddTasks && story.status !== "done" && (
                              <button
                                onClick={() => setSelectedStory(story)}
                                className="ml-2 hover:underline"
                                style={{ color: "var(--color-primary)" }}
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
              <div
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                }}
              >
                <svg
                  className="h-6 w-6"
                  style={{ color: "var(--color-primary)" }}
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
              <p className="mb-1 font-semibold text-[var(--color-foreground)]">
                No stories in this sprint
              </p>
              <p className="text-sm text-[var(--color-muted)]">
                Add stories from the Product Backlog.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
            }}
          >
            <svg
              className="h-6 w-6"
              style={{ color: "var(--color-primary)" }}
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
          <p className="mb-1 font-semibold text-[var(--color-foreground)]">
            No active sprint
          </p>
          <p className="text-sm text-[var(--color-muted)]">
            Start a sprint from the Sprints page to see stories here.
          </p>
        </div>
      )}

      {/* Edit modal */}
      {editingTask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setEditingTask(null)}
          />
          <div
            className="relative m-4 w-full max-w-md overflow-hidden rounded-xl shadow-2xl"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-foreground)",
            }}
          >
            <div
              className="flex items-center justify-between p-5"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <h2 className="text-base font-semibold">Uredi nalogo</h2>
              <button
                onClick={() => setEditingTask(null)}
                style={{ color: "var(--color-muted)" }}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold">
                  Opis naloge
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--color-background)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-foreground)",
                  }}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">
                  Ocena časa (ur)
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.5"
                  value={editHours}
                  onChange={(e) => setEditHours(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--color-background)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-foreground)",
                  }}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold">
                  Predlagani član (opcijsko)
                </label>
                <select
                  value={editAssigneeId}
                  onChange={(e) => setEditAssigneeId(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--color-background)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-foreground)",
                  }}
                >
                  <option value="">— Brez dodelitve —</option>
                  {editLoadingMembers ? (
                    <option disabled>Nalagam...</option>
                  ) : (
                    editDevelopers.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.user?.first_name} {m.user?.last_name} (
                        {m.user?.email})
                      </option>
                    ))
                  )}
                </select>
                <p
                  className="mt-1 text-xs"
                  style={{ color: "var(--color-muted)" }}
                >
                  Član mora nalogo še sprejeti, preden postane dodeljena.
                </p>
              </div>
              {editError && (
                <p
                  className="rounded-lg px-3 py-2 text-xs"
                  style={{
                    background: "var(--color-error-light)",
                    color: "var(--color-error)",
                    border: "1px solid var(--color-error-border)",
                  }}
                >
                  {editError}
                </p>
              )}
            </div>

            <div
              className="flex gap-2 p-4"
              style={{
                borderTop: "1px solid var(--color-border)",
                background: "var(--color-background)",
              }}
            >
              <button
                onClick={() => setEditingTask(null)}
                className="flex-1 rounded-lg px-4 py-2 text-sm font-medium"
                style={{
                  background: "var(--color-surface)",
                  color: "var(--color-muted)",
                  border: "1px solid var(--color-border)",
                }}
              >
                Prekliči
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="flex-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                style={{ background: "var(--color-primary)", color: "#ffffff" }}
              >
                {editSaving ? "Shranjujem..." : "Shrani"}
              </button>
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
