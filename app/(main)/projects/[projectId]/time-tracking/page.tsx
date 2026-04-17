"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import TimeTrackingHelpTooltip from "@/components/features/time-tracking/TimeTrackingHelpTooltip";

type SprintRange = {
  id: string;
  start_date: string;
  end_date: string;
};

type Story = {
  id: string;
  title: string;
  status: string;
  sprint: SprintRange | null;
};

type TaskInfo = {
  id: string;
  title: string;
  description: string | null;
  remaining_time: number | null;
  status: string;
  user_story: Story | null;
};

type TimeLogEntry = {
  id: string;
  task_id: string;
  hours: number;
  date: string;
  logged_at: string;
  remaining_time: number | null;
  task: TaskInfo | null;
};

type LogFormState = {
  taskId: string;
  existingLogId: string | null;
  date: string;
  hours: string;
  remaining: string;
  error: string | null;
  saving: boolean;
};

function formatDateShort(d: string) {
  const date = new Date(d + "T12:00:00");
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}`;
}

export default function TimeTrackingPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [logs, setLogs] = useState<TimeLogEntry[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<TaskInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [logForm, setLogForm] = useState<LogFormState | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsRes, tasksRes] = await Promise.all([
        fetch(`/api/users/me/timelogs?project_id=${projectId}`),
        fetch(`/api/projects/${projectId}/my-tasks`),
      ]);
      if (!logsRes.ok) {
        const body = await logsRes.json();
        setError(body.error ?? "Failed to load time logs.");
        return;
      }
      if (!tasksRes.ok) {
        const body = await tasksRes.json();
        setError(body.error ?? "Failed to load tasks.");
        return;
      }
      setLogs(await logsRes.json());
      setAssignedTasks(await tasksRes.json());
    } catch {
      setError("Failed to load time logs.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const taskMap = new Map<string, TaskInfo>();
  const logsByTask = new Map<string, TimeLogEntry[]>();

  for (const t of assignedTasks) {
    taskMap.set(t.id, t);
  }

  for (const log of logs) {
    if (!log.task) continue;
    if (!taskMap.has(log.task_id)) taskMap.set(log.task_id, log.task);
    if (!logsByTask.has(log.task_id)) logsByTask.set(log.task_id, []);
    logsByTask.get(log.task_id)!.push(log);
  }

  const taskIds = Array.from(taskMap.keys());

  function openLogForm(taskId: string, existingLog?: TimeLogEntry) {
    setLogForm({
      taskId,
      existingLogId: existingLog?.id ?? null,
      date: existingLog?.date ?? today,
      hours: existingLog ? String(existingLog.hours) : "",
      remaining: existingLog?.remaining_time != null ? String(existingLog.remaining_time) : "",
      error: null,
      saving: false,
    });
  }

  async function saveLogForm() {
    if (!logForm) return;
    const hours = Number(logForm.hours);
    const remaining = Number(logForm.remaining);
    if (!logForm.hours || isNaN(hours) || hours <= 0) {
      setLogForm((f) => f && { ...f, error: "Hours must be > 0" });
      return;
    }
    if (logForm.remaining === "" || isNaN(remaining) || remaining < 0) {
      setLogForm((f) => f && { ...f, error: "Remaining must be ≥ 0" });
      return;
    }
    if (logForm.date > today) {
      setLogForm((f) => f && { ...f, error: "Can't log future hours" });
      return;
    }
    setLogForm((f) => f && { ...f, saving: true, error: null });
    const url = logForm.existingLogId
      ? `/api/timelogs/${logForm.existingLogId}`
      : `/api/tasks/${logForm.taskId}/timelogs`;
    const method = logForm.existingLogId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: logForm.date, hours_spent: hours, remaining_time: remaining }),
    });
    if (!res.ok) {
      const b = await res.json();
      setLogForm((f) => f && { ...f, saving: false, error: b.error ?? "Error saving." });
      return;
    }
    setLogForm(null);
    fetchLogs();
  }

  const todayHours = logs.filter((l) => l.date === today).reduce((s, l) => s + Number(l.hours), 0);
  const totalHours = logs.reduce((s, l) => s + Number(l.hours), 0);
  const activeTasks = assignedTasks.filter((t) => t.user_story?.status !== "done").length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">Project</p>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-foreground leading-tight">Time Tracking</h1>
          <TimeTrackingHelpTooltip />
        </div>
        <p className="text-sm text-muted mt-1">Log your daily hours and remaining estimate per task.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-muted mb-1">Today</p>
          <p className="text-2xl font-bold text-foreground">{todayHours.toFixed(1)}h</p>
          <p className="text-xs text-subtle mt-0.5">logged today</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-muted mb-1">Total logged</p>
          <p className="text-2xl font-bold text-foreground">{totalHours.toFixed(1)}h</p>
          <p className="text-xs text-subtle mt-0.5">all time</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-muted mb-1">Active tasks</p>
          <p className="text-2xl font-bold text-foreground">{activeTasks}</p>
          <p className="text-xs text-subtle mt-0.5">assigned to you</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-error-border bg-error-light mb-5">
          <svg className="w-4 h-4 text-error mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-20 justify-center text-muted">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm">Loading...</span>
        </div>
      ) : taskIds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-border bg-surface text-center">
          <div className="w-12 h-12 rounded-xl border border-border bg-background flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
            </svg>
          </div>
          <p className="font-semibold text-foreground mb-1">No tasks assigned</p>
          <p className="text-sm text-subtle">You have no tasks assigned to you in this project.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {taskIds.map((taskId) => {
            const task = taskMap.get(taskId)!;
            const taskLogs = (logsByTask.get(taskId) ?? []).sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
            );
            const isStoryDone = task.user_story?.status === "done";
            const isTaskDone = task.status === "completed";
            const isExpanded = expandedTasks.has(taskId);
            const isShowingForm = logForm?.taskId === taskId;
            const latestRemaining = taskLogs[0]?.remaining_time;

            return (
              <div key={taskId} className="rounded-xl border border-border bg-surface overflow-hidden">
                {/* Task header row */}
                <div className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground text-sm truncate">{task.title}</p>
                      {(isStoryDone || isTaskDone) && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[rgba(52,211,153,0.12)] text-[#34D399] border border-[rgba(52,211,153,0.25)] shrink-0">
                          done
                        </span>
                      )}
                    </div>
                    {task.user_story && (
                      <p className="text-xs text-muted truncate mt-0.5">{task.user_story.title}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {latestRemaining != null && (
                      <span className={`text-xs font-semibold ${latestRemaining === 0 ? "text-[#34D399]" : "text-muted"}`}>
                        {Number(latestRemaining).toFixed(1)}h remaining
                      </span>
                    )}
                    {!isStoryDone && (
                      <button
                        onClick={() => {
                          openLogForm(taskId);
                          setExpandedTasks((p) => {
                            const n = new Set(p);
                            n.add(taskId);
                            return n;
                          });
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/90 transition-colors"
                      >
                        + Log time
                      </button>
                    )}
                    <button
                      onClick={() =>
                        setExpandedTasks((p) => {
                          const n = new Set(p);
                          n.has(taskId) ? n.delete(taskId) : n.add(taskId);
                          return n;
                        })
                      }
                      className="p-1.5 rounded-lg border border-border bg-background text-muted hover:text-foreground transition-colors"
                    >
                      <svg
                        className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Log form */}
                {isShowingForm && logForm && (
                  <div className="border-t border-border px-4 py-3 bg-background flex flex-wrap items-end gap-3">
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-muted block mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={logForm.date}
                        max={today}
                        onChange={(e) => setLogForm((f) => f && { ...f, date: e.target.value })}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-muted block mb-1">
                        Hours logged
                      </label>
                      <input
                        type="number"
                        min="0.25"
                        step="0.25"
                        placeholder="e.g. 3"
                        value={logForm.hours}
                        onChange={(e) => setLogForm((f) => f && { ...f, hours: e.target.value })}
                        className="w-24 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-muted block mb-1">
                        Remaining estimate
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        placeholder="e.g. 4"
                        value={logForm.remaining}
                        onChange={(e) => setLogForm((f) => f && { ...f, remaining: e.target.value })}
                        className="w-24 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={saveLogForm}
                        disabled={logForm.saving}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        {logForm.saving ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => setLogForm(null)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-surface text-muted hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    {logForm.error && <p className="text-xs text-error w-full">{logForm.error}</p>}
                  </div>
                )}

                {/* History table */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {taskLogs.length === 0 ? (
                      <p className="text-xs text-muted px-4 py-3">No time logged yet.</p>
                    ) : (
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-background border-b border-border">
                            <th
                              className="text-left px-4 py-2 font-semibold text-muted uppercase tracking-wide"
                              style={{ width: 100 }}
                            >
                              Date
                            </th>
                            <th
                              className="text-right px-4 py-2 font-semibold text-muted uppercase tracking-wide"
                              style={{ width: 100 }}
                            >
                              Time
                            </th>
                            <th
                              className="text-right px-4 py-2 font-semibold text-muted uppercase tracking-wide"
                              style={{ width: 120 }}
                            >
                              Remaining
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {taskLogs.map((log, i) => (
                            <tr
                              key={log.id}
                              className="border-b border-border last:border-0 hover:bg-background/60 cursor-pointer transition-colors"
                              style={{
                                background:
                                  i % 2 === 0 ? undefined : "var(--color-background)",
                              }}
                              onClick={() => !isStoryDone && openLogForm(taskId, log)}
                            >
                              <td className="px-4 py-2.5 text-foreground">{formatDateShort(log.date)}</td>
                              <td className="px-4 py-2.5 text-right">
                                <span className="font-semibold text-primary">
                                  {Number(log.hours).toFixed(1)}h
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                {log.remaining_time != null ? (
                                  <span
                                    className={`font-semibold ${
                                      log.remaining_time === 0 ? "text-[#34D399]" : "text-foreground"
                                    }`}
                                  >
                                    {Number(log.remaining_time).toFixed(1)}h
                                  </span>
                                ) : (
                                  <span className="text-subtle">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted mt-3">
        Click &quot;+ Log time&quot; to add an entry · Click a row to edit · Remaining = 0 auto-completes the task
      </p>
    </div>
  );
}
