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

type TaskWithAssignee = {
  id: string;
  user_story_id: string;
  title: string;
  description: string | null;
  status: string;
  assignee_id: string | null;
  estimated_hours: number | null;
  logged_hours: number | null;
  assignee?: { id: string; first_name: string; last_name: string } | null;
};

const PRIORITY_CONFIG: Record<string, { label: string; pill: string; dot: string }> = {
  must_have:   { label: "Must Have",   pill: "bg-error-light text-error border border-error-border",         dot: "bg-error" },
  should_have: { label: "Should Have", pill: "bg-accent-light text-accent-text border border-accent-border", dot: "bg-accent" },
  could_have:  { label: "Could Have",  pill: "bg-primary-light text-primary border border-primary-border",   dot: "bg-primary" },
  wont_have:   { label: "Won't Have",  pill: "bg-background text-muted border border-border",                dot: "bg-subtle" },
};

const STATUS_CONFIG: Record<string, { label: string; pill: string; order: number }> = {
  backlog:     { label: "Backlog",     pill: "bg-background text-muted border border-border",                order: 0 },
  ready:       { label: "Ready",       pill: "bg-primary-light text-primary border border-primary-border",   order: 1 },
  in_progress: { label: "In Progress", pill: "bg-accent-light text-accent-text border border-accent-border", order: 2 },
  done:        { label: "Done",        pill: "bg-[rgba(52,211,153,0.12)] text-[#34D399] border border-[rgba(52,211,153,0.25)]", order: 3 },
};

const PRIORITY_ORDER: Record<string, number> = { must_have: 0, should_have: 1, could_have: 2, wont_have: 3 };

type TaskCategory = "unassigned" | "assigned" | "active" | "done";

function getTaskCategory(task: TaskWithAssignee): TaskCategory {
  if (task.status === "completed") return "done";
  if (task.status === "in_progress") return "active";
  if (task.assignee_id) return "assigned";
  return "unassigned";
}

const TASK_CATEGORY_CONFIG: Record<TaskCategory, { label: string; dot: string; border: string; bg: string }> = {
  active:     { label: "Active",     dot: "bg-accent",     border: "border-accent-border",              bg: "bg-accent-light" },
  assigned:   { label: "Assigned",   dot: "bg-primary",    border: "border-primary-border",             bg: "bg-primary-light" },
  unassigned: { label: "Unassigned", dot: "bg-subtle",     border: "border-border",                     bg: "bg-background" },
  done:       { label: "Done",       dot: "bg-[#34D399]",  border: "border-[rgba(52,211,153,0.25)]",    bg: "bg-[rgba(52,211,153,0.08)]" },
};

const CATEGORY_ORDER: TaskCategory[] = ["active", "assigned", "unassigned", "done"];

export default function SprintBoardPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [loading, setLoading] = useState(true);
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [tasksByStory, setTasksByStory] = useState<Record<string, TaskWithAssignee[]>>({});
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [expandedStories, setExpandedStories] = useState<Set<string>>(new Set());

  const fetchTasks = async (storyIds: string[]) => {
    const tasksMap: Record<string, TaskWithAssignee[]> = {};
    await Promise.all(
      storyIds.map(async (storyId) => {
        try {
          const res = await fetch(`/api/stories/${storyId}/tasks`, { credentials: "include" });
          if (res.ok) tasksMap[storyId] = await res.json();
        } catch { /* ignore */ }
      })
    );
    setTasksByStory(tasksMap);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [backlogRes, memberRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/backlog`, { credentials: "include" }),
          fetch(`/api/projects/${projectId}/members/me`, { credentials: "include" }),
        ]);
        if (backlogRes.ok) {
          const data = await backlogRes.json();
          setActiveSprint(data.activeSprint);
          const assigned = data.assigned ?? [];
          setStories(assigned);
          if (assigned.length > 0) await fetchTasks(assigned.map((s: Story) => s.id));
        }
        if (memberRes.ok) {
          const d = await memberRes.json();
          if (d.role) setUserRole(d.role);
        }
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId]);

  const toggleExpanded = (storyId: string) => {
    setExpandedStories((prev) => {
      const next = new Set(prev);
      next.has(storyId) ? next.delete(storyId) : next.add(storyId);
      return next;
    });
  };

  const sorted = [...stories].sort((a, b) => {
    const sd = (STATUS_CONFIG[a.status]?.order ?? 99) - (STATUS_CONFIG[b.status]?.order ?? 99);
    if (sd !== 0) return sd;
    return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
  });

  const totalPoints = stories.reduce((sum, s) => sum + (s.story_points ?? 0), 0);
  const donePoints  = stories.filter((s) => s.status === "done").reduce((sum, s) => sum + (s.story_points ?? 0), 0);
  const doneCount   = stories.filter((s) => s.status === "done").length;
  const canAddTasks = userRole === "scrum_master" || userRole === "developer";

  const allTasks = Object.values(tasksByStory).flat();
  const taskStats = {
    active:     allTasks.filter((t) => getTaskCategory(t) === "active").length,
    assigned:   allTasks.filter((t) => getTaskCategory(t) === "assigned").length,
    unassigned: allTasks.filter((t) => getTaskCategory(t) === "unassigned").length,
    done:       allTasks.filter((t) => getTaskCategory(t) === "done").length,
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="text-sm">Loading Sprint Board...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">Project</p>
        <h1 className="text-3xl font-bold text-foreground leading-tight">Sprint Board</h1>
      </div>

      {activeSprint ? (
        <>
          {/* Sprint info bar */}
          <div className="flex items-center gap-4 p-4 rounded-xl border border-primary-border bg-primary-light mb-6 flex-wrap">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-sm font-semibold text-foreground">{activeSprint.name}</span>
            </div>
            <span className="text-xs text-muted">
              {new Date(activeSprint.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {" – "}
              {new Date(activeSprint.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <div className="ml-auto flex items-center gap-4 text-xs text-muted">
              <span><span className="font-semibold text-foreground">{doneCount}/{stories.length}</span> stories done</span>
              <span><span className="font-semibold text-foreground">{donePoints}/{totalPoints}</span> pts completed</span>
              {activeSprint.velocity && (
                <span>Velocity: <span className="font-semibold text-foreground">{activeSprint.velocity}</span></span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {totalPoints > 0 && (
            <div className="mb-6">
              <div className="flex justify-between text-xs text-muted mb-1.5">
                <span>Progress</span>
                <span>{Math.round((donePoints / totalPoints) * 100)}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#34D399] transition-all"
                  style={{ width: `${Math.round((donePoints / totalPoints) * 100)}%` }}
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
                  <span className={`w-2 h-2 rounded-full ${TASK_CATEGORY_CONFIG[cat].dot}`} />
                  <span className="text-muted">{TASK_CATEGORY_CONFIG[cat].label}</span>
                  <span className="font-semibold text-foreground">{taskStats[cat]}</span>
                </span>
              ))}
            </div>
          )}

          {/* Story list */}
          {sorted.length > 0 ? (
            <div className="space-y-3">
              {sorted.map((story) => {
                const priority   = PRIORITY_CONFIG[story.priority] ?? PRIORITY_CONFIG.wont_have;
                const status     = STATUS_CONFIG[story.status]     ?? STATUS_CONFIG.backlog;
                const storyTasks = tasksByStory[story.id] ?? [];
                const isExpanded = expandedStories.has(story.id);

                const groupedTasks: Record<TaskCategory, TaskWithAssignee[]> = {
                  active:     storyTasks.filter((t) => getTaskCategory(t) === "active"),
                  assigned:   storyTasks.filter((t) => getTaskCategory(t) === "assigned"),
                  unassigned: storyTasks.filter((t) => getTaskCategory(t) === "unassigned"),
                  done:       storyTasks.filter((t) => getTaskCategory(t) === "done"),
                };

                return (
                  <div key={story.id} className="rounded-xl border border-border bg-surface overflow-hidden">
                    {/* Story header */}
                    <div
                      className="flex items-start gap-3 p-4 cursor-pointer hover:bg-background transition-colors"
                      onClick={() => toggleExpanded(story.id)}
                    >
                      <svg
                        className={`w-4 h-4 text-muted mt-1 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-semibold text-foreground leading-snug">{story.title}</p>
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
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${priority.pill}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
                            {priority.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.pill}`}>
                            {status.label}
                          </span>
                          {storyTasks.length > 0 && (
                            <div className="flex items-center gap-1 ml-1">
                              {groupedTasks.active.length > 0 && <span className="w-2 h-2 rounded-full bg-accent" title={`${groupedTasks.active.length} active`} />}
                              {groupedTasks.assigned.length > 0 && <span className="w-2 h-2 rounded-full bg-primary" title={`${groupedTasks.assigned.length} assigned`} />}
                              {groupedTasks.unassigned.length > 0 && <span className="w-2 h-2 rounded-full bg-subtle" title={`${groupedTasks.unassigned.length} unassigned`} />}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedStory(story); }}
                        className="px-2.5 py-1 text-xs font-semibold text-primary bg-primary-light border border-primary-border rounded-lg hover:bg-primary/20 transition-colors flex-shrink-0"
                      >
                        Edit
                      </button>
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
                                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                    <span className="text-[10px] font-bold tracking-widest uppercase text-muted">
                                      {cfg.label} ({tasks.length})
                                    </span>
                                  </div>
                                  <div className="space-y-1.5 pl-3">
                                    {tasks.map((task) => (
                                      <div key={task.id} className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.border} ${cfg.bg}`}>
                                        {category === "done" && (
                                          <svg className="w-4 h-4 text-[#34D399] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <p className={`text-sm font-medium leading-snug ${category === "done" ? "line-through text-muted" : "text-foreground"}`}>
                                            {task.description || task.title}
                                          </p>
                                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted flex-wrap">
                                            {task.estimated_hours != null && (
                                              <span className="flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                  <circle cx="12" cy="12" r="9"/><path strokeLinecap="round" d="M12 7v5l3 3"/>
                                                </svg>
                                                {task.logged_hours ?? 0}h / {task.estimated_hours}h
                                              </span>
                                            )}
                                            {task.assignee ? (
                                              <span className="flex items-center gap-1.5">
                                                <span className="w-5 h-5 rounded-full bg-primary-light text-primary border border-primary-border flex items-center justify-center text-[9px] font-bold">
                                                  {task.assignee.first_name?.[0]}{task.assignee.last_name?.[0]}
                                                </span>
                                                {task.assignee.first_name} {task.assignee.last_name}
                                              </span>
                                            ) : (
                                              <span className="flex items-center gap-1.5 text-subtle">
                                                <span className="w-5 h-5 rounded-full bg-surface border border-border flex items-center justify-center">
                                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                  </svg>
                                                </span>
                                                Unassigned
                                              </span>
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
                            {canAddTasks && story.status !== "done" && (
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
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="font-semibold text-foreground mb-1">No stories in this sprint</p>
              <p className="text-sm text-muted">Add stories from the Product Backlog.</p>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl border border-border bg-surface flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="font-semibold text-foreground mb-1">No active sprint</p>
          <p className="text-sm text-muted">Start a sprint from the Sprints page to see stories here.</p>
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