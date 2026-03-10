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
  estimated_hours: number | null;
  logged_hours: number | null;
  assignee?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
};

const PRIORITY_CONFIG: Record<string, { label: string; pill: string; dot: string }> = {
  must_have:   { label: "Must Have",   pill: "bg-[rgba(252,129,129,0.1)] text-[#FC8181] border border-[rgba(252,129,129,0.25)]",   dot: "bg-[#FC8181]" },
  should_have: { label: "Should Have", pill: "bg-[rgba(139,92,246,0.12)] text-[#A78BFA] border border-[rgba(139,92,246,0.25)]",   dot: "bg-[#8B5CF6]" },
  could_have:  { label: "Could Have",  pill: "bg-[rgba(91,141,239,0.12)] text-[#5B8DEF] border border-[rgba(91,141,239,0.25)]",   dot: "bg-[#5B8DEF]" },
  wont_have:   { label: "Won't Have",  pill: "bg-[rgba(107,122,153,0.12)] text-[#6B7A99] border border-[rgba(107,122,153,0.25)]", dot: "bg-[#6B7A99]" },
};

const STATUS_CONFIG: Record<string, { label: string; pill: string; order: number }> = {
  backlog:     { label: "Backlog",     pill: "bg-[rgba(107,122,153,0.12)] text-[#6B7A99] border border-[rgba(107,122,153,0.25)]", order: 0 },
  ready:       { label: "Ready",       pill: "bg-[rgba(91,141,239,0.12)] text-[#5B8DEF] border border-[rgba(91,141,239,0.25)]",   order: 1 },
  in_progress: { label: "In Progress", pill: "bg-[rgba(139,92,246,0.12)] text-[#A78BFA] border border-[rgba(139,92,246,0.25)]",   order: 2 },
  done:        { label: "Done",        pill: "bg-[rgba(52,211,153,0.12)] text-[#34D399] border border-[rgba(52,211,153,0.25)]",   order: 3 },
};

const PRIORITY_ORDER: Record<string, number> = { must_have: 0, should_have: 1, could_have: 2, wont_have: 3 };

// Task category helpers
function getTaskCategory(task: TaskWithAssignee): "unassigned" | "assigned" | "active" | "done" {
  if (task.status === "done") return "done";
  if (task.status === "in_progress") return "active";
  if (task.assignee_id) return "assigned";
  return "unassigned";
}

const TASK_CATEGORY_CONFIG = {
  unassigned: { label: "Unassigned", color: "bg-gray-400", border: "border-gray-300", bg: "bg-gray-50" },
  assigned:   { label: "Assigned",   color: "bg-blue-400", border: "border-blue-300", bg: "bg-blue-50" },
  active:     { label: "Active",     color: "bg-purple-500", border: "border-purple-400", bg: "bg-purple-50" },
  done:       { label: "Done",       color: "bg-green-500", border: "border-green-400", bg: "bg-green-50" },
};

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
          const res = await fetch(`/api/stories/${storyId}/tasks`, {
            credentials: "include",
          });
          if (res.ok) {
            tasksMap[storyId] = await res.json();
          }
        } catch {
          console.error(`Error fetching tasks for story ${storyId}`);
        }
      })
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
          
          // Fetch tasks for all stories
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
      if (next.has(storyId)) {
        next.delete(storyId);
      } else {
        next.add(storyId);
      }
      return next;
    });
  };

  // Sort stories
  const sorted = [...stories].sort((a, b) => {
    const statusDiff = (STATUS_CONFIG[a.status]?.order ?? 99) - (STATUS_CONFIG[b.status]?.order ?? 99);
    if (statusDiff !== 0) return statusDiff;
    return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
  });

  const totalPoints = stories.reduce((sum, s) => sum + (s.story_points ?? 0), 0);
  const donePoints = stories.filter((s) => s.status === "done").reduce((sum, s) => sum + (s.story_points ?? 0), 0);
  const doneCount = stories.filter((s) => s.status === "done").length;

  const canAddTasks = userRole === "scrum_master" || userRole === "developer";

  // Calculate total tasks stats
  const allTasks = Object.values(tasksByStory).flat();
  const taskStats = {
    unassigned: allTasks.filter((t) => getTaskCategory(t) === "unassigned").length,
    assigned: allTasks.filter((t) => getTaskCategory(t) === "assigned").length,
    active: allTasks.filter((t) => getTaskCategory(t) === "active").length,
    done: allTasks.filter((t) => getTaskCategory(t) === "done").length,
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-[#6B7A99]">
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
        <p className="text-xs font-semibold tracking-widest uppercase text-[#5B8DEF] mb-1">Project</p>
        <h1 className="text-3xl font-bold text-[var(--color-foreground,#E8EDF5)] leading-tight">Sprint Board</h1>
      </div>

      {activeSprint ? (
        <>
          {/* Sprint info bar */}
          <div className="flex items-center gap-4 p-4 rounded-xl border border-[rgba(91,141,239,0.25)] bg-[rgba(91,141,239,0.08)] mb-6 flex-wrap">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#5B8DEF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-sm font-semibold text-[var(--color-foreground,#E8EDF5)]">{activeSprint.name}</span>
            </div>
            <span className="text-xs text-[#6B7A99]">
              {new Date(activeSprint.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {" – "}
              {new Date(activeSprint.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <div className="ml-auto flex items-center gap-4 text-xs text-[#6B7A99]">
              <span><span className="font-semibold text-[var(--color-foreground,#E8EDF5)]">{doneCount}/{stories.length}</span> stories done</span>
              <span><span className="font-semibold text-[var(--color-foreground,#E8EDF5)]">{donePoints}/{totalPoints}</span> pts completed</span>
              {activeSprint.velocity && (
                <span>Velocity: <span className="font-semibold text-[var(--color-foreground,#E8EDF5)]">{activeSprint.velocity}</span></span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {totalPoints > 0 && (
            <div className="mb-6">
              <div className="flex justify-between text-xs text-[#6B7A99] mb-1.5">
                <span>Progress</span>
                <span>{Math.round((donePoints / totalPoints) * 100)}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#2D3748] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#34D399] transition-all"
                  style={{ width: `${Math.round((donePoints / totalPoints) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Task summary */}
          {allTasks.length > 0 && (
            <div className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-[#1C2333] border border-[#2D3748]">
              <span className="text-xs text-[#6B7A99]">Tasks:</span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                  <span className="text-[#6B7A99]">Unassigned</span>
                  <span className="font-semibold text-[var(--color-foreground,#E8EDF5)]">{taskStats.unassigned}</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  <span className="text-[#6B7A99]">Assigned</span>
                  <span className="font-semibold text-[var(--color-foreground,#E8EDF5)]">{taskStats.assigned}</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  <span className="text-[#6B7A99]">Active</span>
                  <span className="font-semibold text-[var(--color-foreground,#E8EDF5)]">{taskStats.active}</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span className="text-[#6B7A99]">Done</span>
                  <span className="font-semibold text-[var(--color-foreground,#E8EDF5)]">{taskStats.done}</span>
                </span>
              </div>
            </div>
          )}

          {/* Story list */}
          {sorted.length > 0 ? (
            <div className="space-y-3">
              {sorted.map((story, i) => {
                const priority = PRIORITY_CONFIG[story.priority] ?? PRIORITY_CONFIG.wont_have;
                const status = STATUS_CONFIG[story.status] ?? STATUS_CONFIG.backlog;
                const storyTasks = tasksByStory[story.id] ?? [];
                const isExpanded = expandedStories.has(story.id);

                // Group tasks by category
                const groupedTasks = {
                  unassigned: storyTasks.filter((t) => getTaskCategory(t) === "unassigned"),
                  assigned: storyTasks.filter((t) => getTaskCategory(t) === "assigned"),
                  active: storyTasks.filter((t) => getTaskCategory(t) === "active"),
                  done: storyTasks.filter((t) => getTaskCategory(t) === "done"),
                };

                return (
                  <div key={story.id} className="rounded-xl border border-[#2D3748] bg-[#1C2333] overflow-hidden">
                    {/* Story header */}
                    <div
                      className="flex items-start gap-3 p-4 hover:bg-[#1C2333]/80 transition-all cursor-pointer"
                      onClick={() => toggleExpanded(story.id)}
                    >
                      {/* Expand icon */}
                      <svg
                        className={`w-4 h-4 text-[#6B7A99] mt-1 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-semibold text-[var(--color-foreground,#E8EDF5)] leading-snug">{story.title}</p>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {storyTasks.length > 0 && (
                              <span className="text-xs text-[#6B7A99] bg-[#151C2B] border border-[#2D3748] px-2 py-0.5 rounded-lg">
                                {storyTasks.length} tasks
                              </span>
                            )}
                            {story.story_points != null && (
                              <span className="text-xs text-[#6B7A99] bg-[#151C2B] border border-[#2D3748] px-2 py-0.5 rounded-lg">
                                {story.story_points} pts
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${priority.pill}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
                            {priority.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.pill}`}>
                            {status.label}
                          </span>
                          
                          {/* Task category indicators */}
                          {storyTasks.length > 0 && (
                            <div className="flex items-center gap-1 ml-2">
                              {groupedTasks.active.length > 0 && (
                                <span className="w-2 h-2 rounded-full bg-purple-500" title={`${groupedTasks.active.length} active`}></span>
                              )}
                              {groupedTasks.assigned.length > 0 && (
                                <span className="w-2 h-2 rounded-full bg-blue-400" title={`${groupedTasks.assigned.length} assigned`}></span>
                              )}
                              {groupedTasks.unassigned.length > 0 && (
                                <span className="w-2 h-2 rounded-full bg-gray-400" title={`${groupedTasks.unassigned.length} unassigned`}></span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Open detail button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStory(story);
                        }}
                        className="px-2 py-1 text-xs text-[#5B8DEF] hover:bg-[#5B8DEF]/10 rounded transition-colors"
                      >
                        Open
                      </button>
                    </div>

                    {/* Expanded tasks */}
                    {isExpanded && (
                      <div className="border-t border-[#2D3748] p-4 bg-[#151C2B]">
                        {storyTasks.length > 0 ? (
                          <div className="space-y-4">
                            {(["active", "assigned", "unassigned", "done"] as const).map((category) => {
                              const tasks = groupedTasks[category];
                              if (tasks.length === 0) return null;
                              const config = TASK_CATEGORY_CONFIG[category];

                              return (
                                <div key={category}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`w-2 h-2 rounded-full ${config.color}`}></span>
                                    <span className="text-xs font-semibold text-[#6B7A99] uppercase tracking-wider">
                                      {config.label} ({tasks.length})
                                    </span>
                                  </div>
                                  <div className="space-y-2 pl-4">
                                    {tasks.map((task) => (
                                      <div
                                        key={task.id}
                                        className={`p-3 rounded-lg border ${config.border} ${config.bg}`}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                              {category === "done" && (
                                                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                              )}
                                              <p className="text-sm font-medium text-gray-900">
                                                {task.description || task.title}
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                                              {task.estimated_hours && (
                                                <span>⏱️ {task.logged_hours ?? 0}h / {task.estimated_hours}h</span>
                                              )}
                                              {task.assignee ? (
                                                <span className="flex items-center gap-1">
                                                  <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-[10px] font-medium">
                                                    {task.assignee.first_name?.[0]}{task.assignee.last_name?.[0]}
                                                  </span>
                                                  {task.assignee.first_name} {task.assignee.last_name}
                                                </span>
                                              ) : (
                                                <span className="flex items-center gap-1 text-gray-400">
                                                  <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                                                    <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                  </span>
                                                  Unassigned
                                                </span>
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
                          <div className="text-center py-4 text-[#6B7A99] text-sm">
                            No tasks yet.
                            {canAddTasks && story.status !== "done" && (
                              <button
                                onClick={() => setSelectedStory(story)}
                                className="ml-2 text-[#5B8DEF] hover:underline"
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
              <div className="w-14 h-14 rounded-2xl border border-[#2D3748] bg-[#1C2333] flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-[#5B8DEF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="font-semibold text-[var(--color-foreground,#E8EDF5)] mb-1">No stories in this sprint</p>
              <p className="text-sm text-[#6B7A99]">Add stories from the Product Backlog.</p>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl border border-[#2D3748] bg-[#1C2333] flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-[#5B8DEF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="font-semibold text-[var(--color-foreground,#E8EDF5)] mb-1">No active sprint</p>
          <p className="text-sm text-[#6B7A99]">Start a sprint from the Sprints page to see stories here.</p>
        </div>
      )}

      {/* Story Detail Modal */}
      {selectedStory && (
        <StoryDetailModal
          isOpen={!!selectedStory}
          onClose={() => {
            setSelectedStory(null);
            // Refresh tasks after modal close
            if (stories.length > 0) {
              fetchTasks(stories.map((s) => s.id));
            }
          }}
          story={selectedStory}
          projectId={projectId}
          canAddTasks={canAddTasks}
        />
      )}
    </div>
  );
}