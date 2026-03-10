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

const PRIORITY_CONFIG: Record<string, { label: string; pill: string; dot: string }> = {
  must_have:   { label: "Must Have",   pill: "bg-red-100 text-red-800 border border-red-200",     dot: "bg-red-500" },
  should_have: { label: "Should Have", pill: "bg-purple-100 text-purple-800 border border-purple-200", dot: "bg-purple-500" },
  could_have:  { label: "Could Have",  pill: "bg-blue-100 text-blue-800 border border-blue-200",   dot: "bg-blue-500" },
  wont_have:   { label: "Won't Have",  pill: "bg-gray-100 text-gray-800 border border-gray-200",   dot: "bg-gray-500" },
};

const STATUS_CONFIG: Record<string, { label: string; pill: string }> = {
  backlog:     { label: "Backlog",     pill: "bg-gray-100 text-gray-800" },
  ready:       { label: "Ready",       pill: "bg-blue-100 text-blue-800" },
  in_progress: { label: "In Progress", pill: "bg-purple-100 text-purple-800" },
  done:        { label: "Done",        pill: "bg-green-100 text-green-800" },
};

type TaskCategory = "unassigned" | "assigned" | "active" | "done";

function getTaskCategory(task: TaskWithAssignee): TaskCategory {
  if (task.status === "done") return "done";
  if (task.status === "in_progress") return "active";
  if (task.assignee_id) return "assigned";
  return "unassigned";
}

const TASK_CATEGORY_CONFIG: Record<TaskCategory, { label: string; color: string; border: string; bg: string }> = {
  unassigned: { label: "Unassigned", color: "bg-gray-400", border: "border-gray-300", bg: "bg-gray-50" },
  assigned:   { label: "Assigned",   color: "bg-blue-400", border: "border-blue-300", bg: "bg-blue-50" },
  active:     { label: "Active",     color: "bg-purple-500", border: "border-purple-400", bg: "bg-purple-50" },
  done:       { label: "Done",       color: "bg-green-500", border: "border-green-400", bg: "bg-green-50" },
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

  const priority = PRIORITY_CONFIG[story.priority] ?? PRIORITY_CONFIG.should_have;
  const status = STATUS_CONFIG[story.status] ?? STATUS_CONFIG.backlog;

  const fetchTasks = async () => {
    setLoadingTasks(true);
    try {
      const res = await fetch(`/api/stories/${story.id}/tasks`, {
        credentials: "include",
      });
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

  if (!isOpen) return null;

  const totalEstimated = tasks.reduce((sum, t) => sum + (t.estimated_hours ?? 0), 0);
  const totalLogged = tasks.reduce((sum, t) => sum + (t.logged_hours ?? 0), 0);

  const groupedTasks: Record<TaskCategory, TaskWithAssignee[]> = {
    unassigned: tasks.filter((t) => getTaskCategory(t) === "unassigned"),
    assigned: tasks.filter((t) => getTaskCategory(t) === "assigned"),
    active: tasks.filter((t) => getTaskCategory(t) === "active"),
    done: tasks.filter((t) => getTaskCategory(t) === "done"),
  };

  const categoryOrder: TaskCategory[] = ["active", "assigned", "unassigned", "done"];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />

        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl m-4 max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${priority.pill}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
                    {priority.label}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.pill}`}>
                    {status.label}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-gray-900">{story.title}</h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
              {story.story_points != null && (
                <span className="flex items-center gap-1">
                  <span className="font-medium text-gray-700">{story.story_points}</span> story points
                </span>
              )}
              {story.business_value != null && (
                <span className="flex items-center gap-1">
                  BV: <span className="font-medium text-gray-700">{story.business_value}</span>
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {story.description && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Description</h3>
                <p className="text-sm text-gray-600">{story.description}</p>
              </div>
            )}

            {/* Tasks section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">
                    Tasks ({tasks.length})
                  </h3>
                  {tasks.length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {totalLogged}h / {totalEstimated}h completed
                    </p>
                  )}
                </div>
                {canAddTasks && story.status !== "done" && (
                  <button
                    onClick={() => setIsCreateTaskOpen(true)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md"
                  >
                    + Add Task
                  </button>
                )}
              </div>

              {tasks.length > 0 && (
                <div className="flex items-center gap-4 mb-4 text-xs">
                  {categoryOrder.map((cat) => {
                    const config = TASK_CATEGORY_CONFIG[cat];
                    const count = groupedTasks[cat].length;
                    return (
                      <span key={cat} className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${config.color}`}></span>
                        <span className="text-gray-500">{config.label}</span>
                        <span className="font-medium text-gray-700">{count}</span>
                      </span>
                    );
                  })}
                </div>
              )}

              {loadingTasks ? (
                <div className="text-center py-8 text-gray-500">
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
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-2 h-2 rounded-full ${config.color}`}></span>
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {config.label} ({categoryTasks.length})
                          </span>
                        </div>
                        <div className="space-y-2">
                          {categoryTasks.map((task) => {
                            const isUpdating = updatingTaskId === task.id;
                            
                            return (
                              <div
                                key={task.id}
                                className={`p-3 rounded-lg border ${config.border} ${config.bg} ${isUpdating ? "opacity-50" : ""}`}
                              >
                                <div className="flex items-start gap-3">
                                  {/* Checkbox for done */}
                                  <button
                                    onClick={() => updateTaskStatus(task.id, task.status === "done" ? "todo" : "done")}
                                    disabled={isUpdating}
                                    className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                      task.status === "done"
                                        ? "bg-green-500 border-green-500 text-white"
                                        : "border-gray-300 hover:border-green-400"
                                    }`}
                                  >
                                    {task.status === "done" && (
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </button>

                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${task.status === "done" ? "text-gray-500 line-through" : "text-gray-900"}`}>
                                      {task.description || task.title}
                                    </p>
                                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
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

                                  {/* Action buttons */}
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {task.status === "todo" && (
                                      <button
                                        onClick={() => updateTaskStatus(task.id, "in_progress")}
                                        disabled={isUpdating}
                                        className="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 rounded transition-colors"
                                      >
                                        Start
                                      </button>
                                    )}
                                    {task.status === "in_progress" && (
                                      <button
                                        onClick={() => updateTaskStatus(task.id, "todo")}
                                        disabled={isUpdating}
                                        className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                                      >
                                        Pause
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
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-gray-500 text-sm">No tasks yet.</p>
                  {canAddTasks && story.status !== "done" && (
                    <button
                      onClick={() => setIsCreateTaskOpen(true)}
                      className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Add first task →
                    </button>
                  )}
                </div>
              )}

              {story.status === "done" && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ This story is already completed. Tasks cannot be added.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-md"
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