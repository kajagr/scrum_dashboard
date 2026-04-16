"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  user_story: Story | null;
};

type TimeLogEntry = {
  id: string;
  task_id: string;
  hours: number;
  date: string;
  logged_at: string;
  task: TaskInfo | null;
};

function getWeekRange(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    from: monday.toISOString().split("T")[0],
    to: sunday.toISOString().split("T")[0],
  };
}

function getDatesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) {
    dates.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function formatDateShort(d: string) {
  const date = new Date(d + "T12:00:00");
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}`;
}

function formatWeekLabel(from: string, to: string) {
  const f = new Date(from + "T12:00:00");
  const t = new Date(to + "T12:00:00");
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  return `${fmt(f)} – ${fmt(t)}`;
}

export default function TimeTrackingPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [fromDate, setFromDate] = useState(() => getWeekRange(0).from);
  const [toDate, setToDate] = useState(() => getWeekRange(0).to);
  const [logs, setLogs] = useState<TimeLogEntry[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<TaskInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffsetState] = useState(0);

  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [cellValue, setCellValue] = useState("");
  const [cellError, setCellError] = useState<string | null>(null);

  const [editingRemaining, setEditingRemaining] = useState<string | null>(null);
  const [remainingValue, setRemainingValue] = useState("");
  const [remainingError, setRemainingError] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsRes, tasksRes] = await Promise.all([
        fetch(`/api/users/me/timelogs?from_date=${fromDate}&to_date=${toDate}&project_id=${projectId}`),
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
  }, [fromDate, toDate, projectId]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const dates = getDatesInRange(fromDate, toDate);
  const today = new Date().toISOString().split("T")[0];

  const logMap = new Map<string, Map<string, TimeLogEntry>>();
  const taskMap = new Map<string, TaskInfo>();

  // Seed taskMap with all assigned tasks so they always show
  for (const t of assignedTasks) {
    taskMap.set(t.id, t);
  }

  // Layer in log data — only for tasks already in taskMap (current project, not completed)
  for (const log of logs) {
    if (!log.task || !taskMap.has(log.task_id)) continue;
    taskMap.set(log.task_id, log.task);
    if (!logMap.has(log.task_id)) logMap.set(log.task_id, new Map());
    logMap.get(log.task_id)!.set(log.date, log);
  }
  const taskIds = Array.from(taskMap.keys());

  // Summary stats
  const totalHoursThisWeek = logs.reduce((s, l) => s + Number(l.hours), 0);
  const todayHours = logs.filter((l) => l.date === today).reduce((s, l) => s + Number(l.hours), 0);
  const activeTasks = taskIds.filter((id) => taskMap.get(id)?.user_story?.status !== "done").length;
  const isCurrentWeek = weekOffset === 0;

  function applyWeekOffset(offset: number) {
    setWeekOffsetState(offset);
    const range = getWeekRange(offset);
    setFromDate(range.from);
    setToDate(range.to);
  }

  function startEditCell(taskId: string, date: string) {
    const existing = logMap.get(taskId)?.get(date);
    setEditingCell(`${taskId}|${date}`);
    setCellValue(existing ? String(existing.hours) : "");
    setCellError(null);
  }

  async function saveCell(taskId: string, date: string, value: string) {
    const hours = Number(value);
    if (!value || isNaN(hours) || hours <= 0) { setCellError("Must be > 0"); return; }
    if (date > today) { setCellError("Can't log future hours"); return; }
    const task = taskMap.get(taskId);
    const sprint = task?.user_story?.sprint;
    if (sprint && (date < sprint.start_date || date > sprint.end_date)) {
      setCellError(`Only dates within sprint (${sprint.start_date} – ${sprint.end_date})`);
      return;
    }
    setCellError(null);
    const existing = logMap.get(taskId)?.get(date);
    if (existing) {
      const res = await fetch(`/api/timelogs/${existing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours_spent: hours }),
      });
      if (!res.ok) { const b = await res.json(); setCellError(b.error ?? "Error saving."); return; }
    } else {
      const res = await fetch(`/api/tasks/${taskId}/timelogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, hours_spent: hours }),
      });
      if (!res.ok) { const b = await res.json(); setCellError(b.error ?? "Error saving."); return; }
    }
    setEditingCell(null);
    fetchLogs();
  }

  function handleCellKeyDown(e: React.KeyboardEvent, taskId: string, date: string) {
    if (e.key === "Enter") { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); saveCell(taskId, date, cellValue); }
    else if (e.key === "Escape") { setEditingCell(null); setCellError(null); }
  }

  function handleCellBlur(taskId: string, date: string) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (cellValue) saveCell(taskId, date, cellValue);
      else setEditingCell(null);
    }, 300);
  }

  function startEditRemaining(taskId: string) {
    const task = taskMap.get(taskId);
    setEditingRemaining(taskId);
    setRemainingValue(task?.remaining_time != null ? String(task.remaining_time) : "");
    setRemainingError(null);
  }

  async function saveRemaining(taskId: string, value: string) {
    const hours = Number(value);
    if (value === "" || isNaN(hours) || hours < 0) { setRemainingError("Must be ≥ 0"); return; }
    setRemainingError(null);
    const res = await fetch(`/api/tasks/${taskId}/remaining-time`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remaining_time: hours }),
    });
    if (!res.ok) { const b = await res.json(); setRemainingError(b.error ?? "Error saving."); return; }
    setEditingRemaining(null);
    fetchLogs();
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">Project</p>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-foreground leading-tight">Time Tracking</h1>
          <TimeTrackingHelpTooltip />
        </div>
        <p className="text-sm text-muted mt-1">Log and review your hours per task.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-muted mb-1">This week</p>
          <p className="text-2xl font-bold text-foreground">{totalHoursThisWeek.toFixed(1)}h</p>
          <p className="text-xs text-subtle mt-0.5">total logged</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-muted mb-1">Today</p>
          <p className="text-2xl font-bold text-foreground">{todayHours.toFixed(1)}h</p>
          <p className="text-xs text-subtle mt-0.5">{(() => {
            const now = new Date();
            const day = String(now.getDate()).padStart(2, "0");
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const year = now.getFullYear();
            const weekday = now.toLocaleDateString("en-GB", { weekday: "long" });
            return `${weekday}, ${day}.${month}.${year}`;
          })()}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-muted mb-1">Active tasks</p>
          <p className="text-2xl font-bold text-foreground">{activeTasks}</p>
          <p className="text-xs text-subtle mt-0.5">in this period</p>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => applyWeekOffset(weekOffset - 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-surface text-muted hover:text-foreground hover:border-primary transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Prev
          </button>
          <button
            onClick={() => applyWeekOffset(0)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              isCurrentWeek
                ? "bg-primary-light text-primary border-primary-border"
                : "border-border bg-surface text-muted hover:text-foreground hover:border-primary"
            }`}
          >
            This week
          </button>
          <button
            onClick={() => applyWeekOffset(weekOffset + 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-surface text-muted hover:text-foreground hover:border-primary transition-colors"
          >
            Next
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium text-foreground">{formatWeekLabel(fromDate, toDate)}</span>
        </div>

        {/* Custom range */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setWeekOffsetState(99); }}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:border-primary"
          />
          <span className="text-xs text-muted">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setWeekOffsetState(99); }}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:border-primary"
          />
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
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-surface">
                  <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wide border-b border-border sticky left-0 bg-surface z-10" style={{ minWidth: 240 }}>
                    Task
                  </th>
                  {dates.map((d) => (
                    <th
                      key={d}
                      className="text-center px-3 py-3 text-xs border-b border-border border-l border-border"
                      style={{
                        minWidth: 80,
                        color: d === today ? "var(--color-primary)" : "var(--color-muted)",
                        fontWeight: d === today ? 700 : 500,
                        background: d === today ? "var(--color-primary-light)" : undefined,
                      }}
                    >
                      {formatDateShort(d)}
                    </th>
                  ))}
                  <th className="text-center px-3 py-3 font-semibold text-muted text-xs uppercase tracking-wide border-b border-border border-l" style={{ minWidth: 100 }}>
                    Remaining
                  </th>
                  <th className="text-center px-3 py-3 font-semibold text-muted text-xs uppercase tracking-wide border-b border-border border-l" style={{ minWidth: 70 }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {taskIds.map((taskId, i) => {
                  const task = taskMap.get(taskId)!;
                  const taskLogs = logMap.get(taskId) ?? new Map<string, TimeLogEntry>();
                  const rowTotal = Array.from(taskLogs.values()).reduce((s, l) => s + Number(l.hours), 0);
                  const isStoryDone = task.user_story?.status === "done";
                  const isEditingRem = editingRemaining === taskId;

                  return (
                    <tr
                      key={taskId}
                      className="group"
                      style={{
                        background: i % 2 === 0 ? "var(--color-background)" : "var(--color-surface)",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      {/* Task cell */}
                      <td
                        className="px-4 py-3 border-r border-border sticky left-0 z-10"
                        style={{ background: i % 2 === 0 ? "var(--color-background)" : "var(--color-surface)" }}
                      >
                        <div className="font-medium text-foreground leading-snug text-sm">{task.title}</div>
                        {task.user_story && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-xs text-muted truncate max-w-[180px]">{task.user_story.title}</p>
                            {isStoryDone && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[rgba(52,211,153,0.12)] text-[#34D399] border border-[rgba(52,211,153,0.25)]">
                                done
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Day cells */}
                      {dates.map((d) => {
                        const log = taskLogs.get(d);
                        const key = `${taskId}|${d}`;
                        const isEditing = editingCell === key;
                        const isFuture = d > today;
                        const sprint = task.user_story?.sprint;
                        const isOutsideSprint = sprint != null && (d < sprint.start_date || d > sprint.end_date);
                        const isBlocked = isStoryDone || isFuture || isOutsideSprint;

                        return (
                          <td
                            key={d}
                            className="text-center px-2 py-2 border-l border-border"
                            style={{
                              cursor: isBlocked ? "default" : "pointer",
                              background: d === today ? "var(--color-primary-light)" : isOutsideSprint ? "var(--color-surface)" : undefined,
                              opacity: isOutsideSprint ? 0.35 : undefined,
                            }}
                            onClick={() => { if (!isBlocked) startEditCell(taskId, d); }}
                          >
                            {isEditing ? (
                              <div>
                                <input
                                  autoFocus
                                  type="number"
                                  min="0.01"
                                  step="0.25"
                                  value={cellValue}
                                  onChange={(e) => setCellValue(e.target.value)}
                                  onKeyDown={(e) => handleCellKeyDown(e, taskId, d)}
                                  onBlur={() => handleCellBlur(taskId, d)}
                                  className="w-14 text-center text-xs px-1.5 py-1 rounded-lg bg-background border border-primary text-foreground focus:outline-none"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                {cellError && <div className="text-[10px] text-error mt-0.5">{cellError}</div>}
                              </div>
                            ) : log ? (
                              <span className="text-xs font-semibold text-foreground px-2 py-0.5 rounded-lg bg-primary-light text-primary border border-primary-border">
                                {Number(log.hours).toFixed(1)}h
              				        </span>
                            ) : (
                              <span className="text-xs text-subtle opacity-0 group-hover:opacity-100 transition-opacity">
                                {isFuture || isOutsideSprint ? "—" : "+"}
                              </span>
                            )}
                          </td>
                        );
                      })}

                      {/* Remaining */}
                      <td
                        className="text-center px-2 py-2 border-l border-border"
                        style={{ cursor: isStoryDone ? "default" : "pointer" }}
                        onClick={() => { if (!isStoryDone) startEditRemaining(taskId); }}
                      >
                        {isEditingRem ? (
                          <div>
                            <input
                              autoFocus
                              type="number"
                              min="0"
                              step="0.25"
                              value={remainingValue}
                              onChange={(e) => setRemainingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveRemaining(taskId, remainingValue);
                                else if (e.key === "Escape") setEditingRemaining(null);
                              }}
                              onBlur={() => { if (remainingValue !== "") saveRemaining(taskId, remainingValue); else setEditingRemaining(null); }}
                              className="w-14 text-center text-xs px-1.5 py-1 rounded-lg bg-background border border-primary text-foreground focus:outline-none"
                              onClick={(e) => e.stopPropagation()}
                            />
                            {remainingError && <div className="text-[10px] text-error mt-0.5">{remainingError}</div>}
                          </div>
                        ) : task.remaining_time != null ? (
                          <span className={`text-xs font-semibold ${task.remaining_time === 0 ? "text-[#34D399]" : "text-foreground"}`}>
                            {Number(task.remaining_time).toFixed(1)}h
                          </span>
                        ) : (
                          <span className="text-xs text-subtle">—</span>
                        )}
                      </td>

                      {/* Row total */}
                      <td className="text-center px-3 py-2 border-l border-border">
                        <span className="text-xs font-bold text-foreground">
                          {rowTotal > 0 ? `${rowTotal.toFixed(1)}h` : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Footer totals */}
              <tfoot>
                <tr className="bg-surface border-t-2 border-border">
                  <td className="px-4 py-3 text-xs font-bold text-muted uppercase tracking-wide sticky left-0 bg-surface border-r border-border">
                    Total
                  </td>
                  {dates.map((d) => {
                    const dayTotal = logs.filter((l) => l.date === d).reduce((s, l) => s + Number(l.hours), 0);
                    return (
                      <td
                        key={d}
                        className="text-center px-3 py-3 border-l border-border text-xs font-bold"
                        style={{
                          color: d === today ? "var(--color-primary)" : "var(--color-foreground)",
                          background: d === today ? "var(--color-primary-light)" : undefined,
                        }}
                      >
                        {dayTotal > 0 ? `${dayTotal.toFixed(1)}h` : "—"}
                      </td>
                    );
                  })}
                  <td className="border-l border-border" />
                  <td className="text-center px-3 py-3 border-l border-border text-xs font-bold text-foreground">
                    {totalHoursThisWeek.toFixed(1)}h
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted mt-3">
        Click any cell to edit hours · Enter to save · Escape to cancel
      </p>
    </div>
  );
}