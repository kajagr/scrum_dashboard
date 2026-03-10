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
  canAddTasks: boolean; // true če je scrum_master ali developer
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

const TASK_STATUS_CONFIG: Record<string, { label: string; pill: string }> = {
  todo:        { label: "To Do",       pill: "bg-gray-100 text-gray-700" },
  in_progress: { label: "In Progress", pill: "bg-blue-100 text-blue-700" },
  done:        { label: "Done",        pill: "bg-green-100 text-green-700" },
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
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);

  const priority = PRIORITY_CONFIG[story.priority] ?? PRIORITY_CONFIG.should_have;
  const status = STATUS_CONFIG[story.status] ?? STATUS_CONFIG.backlog;

  // Fetch tasks for this story
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
      console.error("Napaka pri nalaganju nalog.");
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
    fetchTasks(); // Refresh tasks after creating
    router.refresh();
  };

  if (!isOpen) return null;

  const totalEstimated = tasks.reduce((sum, t) => sum + (t.estimated_hours ?? 0), 0);
  const totalLogged = tasks.reduce((sum, t) => sum + (t.logged_hours ?? 0), 0);

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

            {/* Story meta */}
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
            {/* Description */}
            {story.description && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Opis</h3>
                <p className="text-sm text-gray-600">{story.description}</p>
              </div>
            )}

            {/* Tasks section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">
                    Naloge ({tasks.length})
                  </h3>
                  {tasks.length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {totalLogged}h / {totalEstimated}h opravljeno
                    </p>
                  )}
                </div>
                {canAddTasks && story.status !== "done" && (
                  <button
                    onClick={() => setIsCreateTaskOpen(true)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md"
                  >
                    + Dodaj nalogo
                  </button>
                )}
              </div>

              {loadingTasks ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">Nalaganje nalog...</p>
                </div>
              ) : tasks.length > 0 ? (
                <div className="space-y-2">
                  {tasks.map((task) => {
                    const taskStatus = TASK_STATUS_CONFIG[task.status] ?? TASK_STATUS_CONFIG.todo;
                    return (
                      <div
                        key={task.id}
                        className="p-3 bg-gray-50 border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {task.description || task.title}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${taskStatus.pill}`}>
                                {taskStatus.label}
                              </span>
                              {task.estimated_hours && (
                                <span>
                                  ⏱️ {task.logged_hours ?? 0}h / {task.estimated_hours}h
                                </span>
                              )}
                              {task.assignee && (
                                <span>
                                  👤 {task.assignee.first_name} {task.assignee.last_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-gray-500 text-sm">Ni še nalog.</p>
                  {canAddTasks && story.status !== "done" && (
                    <button
                      onClick={() => setIsCreateTaskOpen(true)}
                      className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Dodaj prvo nalogo →
                    </button>
                  )}
                </div>
              )}

              {/* Warning if story is done */}
              {story.status === "done" && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Ta zgodba je že realizirana. Nalog ni mogoče več dodajati.
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
              Zapri
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