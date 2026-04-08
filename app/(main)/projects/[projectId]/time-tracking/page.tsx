"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";

type Story = {
  id: string;
  title: string;
  status: string;
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
  const day = now.getDay(); // 0=Sun, 1=Mon...
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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function TimeTrackingPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [fromDate, setFromDate] = useState(() => getWeekRange(0).from);
  const [toDate, setToDate] = useState(() => getWeekRange(0).to);
  const [logs, setLogs] = useState<TimeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // editing state: key = "taskId|date" -> hours input value
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [cellValue, setCellValue] = useState("");
  const [cellError, setCellError] = useState<string | null>(null);

  // remaining time editing: key = taskId
  const [editingRemaining, setEditingRemaining] = useState<string | null>(null);
  const [remainingValue, setRemainingValue] = useState("");
  const [remainingError, setRemainingError] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/users/me/timelogs?from_date=${fromDate}&to_date=${toDate}`,
      );
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Failed to load time logs.");
        return;
      }
      const data: TimeLogEntry[] = await res.json();
      setLogs(data);
    } catch {
      setError("Failed to load time logs.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const dates = getDatesInRange(fromDate, toDate);
  const today = new Date().toISOString().split("T")[0];

  // Group logs: taskId -> date -> log
  const logMap = new Map<string, Map<string, TimeLogEntry>>();
  const taskMap = new Map<string, TaskInfo>();
  for (const log of logs) {
    if (!log.task) continue;
    taskMap.set(log.task_id, log.task);
    if (!logMap.has(log.task_id)) logMap.set(log.task_id, new Map());
    logMap.get(log.task_id)!.set(log.date, log);
  }

  const taskIds = Array.from(taskMap.keys());

  function startEditCell(taskId: string, date: string) {
    const existing = logMap.get(taskId)?.get(date);
    setEditingCell(`${taskId}|${date}`);
    setCellValue(existing ? String(existing.hours) : "");
    setCellError(null);
  }

  async function saveCell(taskId: string, date: string, value: string) {
    const hours = Number(value);
    if (!value || isNaN(hours) || hours <= 0) {
      setCellError("Ure morajo biti večje od 0.");
      return;
    }
    if (date > today) {
      setCellError("Datum ne sme biti v prihodnosti.");
      return;
    }
    setCellError(null);

    const existing = logMap.get(taskId)?.get(date);
    if (existing) {
      // PUT to update existing log
      const res = await fetch(`/api/timelogs/${existing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours_spent: hours }),
      });
      if (!res.ok) {
        const body = await res.json();
        setCellError(body.error ?? "Napaka pri shranjevanju.");
        return;
      }
    } else {
      // POST to create new log
      const res = await fetch(`/api/tasks/${taskId}/timelogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, hours_spent: hours }),
      });
      if (!res.ok) {
        const body = await res.json();
        setCellError(body.error ?? "Napaka pri shranjevanju.");
        return;
      }
    }
    setEditingCell(null);
    fetchLogs();
  }

  function handleCellKeyDown(
    e: React.KeyboardEvent,
    taskId: string,
    date: string,
  ) {
    if (e.key === "Enter") {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveCell(taskId, date, cellValue);
    } else if (e.key === "Escape") {
      setEditingCell(null);
      setCellError(null);
    }
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
    if (value === "" || isNaN(hours) || hours < 0) {
      setRemainingError("Preostali čas mora biti 0 ali več.");
      return;
    }
    setRemainingError(null);
    const res = await fetch(`/api/tasks/${taskId}/remaining-time`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remaining_time: hours }),
    });
    if (!res.ok) {
      const body = await res.json();
      setRemainingError(body.error ?? "Napaka pri shranjevanju.");
      return;
    }
    setEditingRemaining(null);
    fetchLogs();
  }

  function handleRemainingKeyDown(e: React.KeyboardEvent, taskId: string) {
    if (e.key === "Enter") saveRemaining(taskId, remainingValue);
    else if (e.key === "Escape") setEditingRemaining(null);
  }

  function setWeekOffset(offset: number) {
    const range = getWeekRange(offset);
    setFromDate(range.from);
    setToDate(range.to);
  }

  const isCurrentWeek =
    fromDate === getWeekRange(0).from && toDate === getWeekRange(0).to;

  return (
    <div className="p-6 text-foreground">
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-1">
          Project
        </p>
        <h1 className="text-3xl font-bold text-foreground leading-tight mb-1">
          Time Tracking
        </h1>
        <p className="text-sm text-muted">
          View and edit your logged hours per task and day.
        </p>
      </div>

      {/* Date range controls */}
      <div
        className="flex flex-wrap items-center gap-3 mb-6 p-4 rounded-xl"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <span className="text-sm font-medium">Date range:</span>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="text-sm px-2 py-1 rounded border"
          style={{
            background: "var(--color-background)",
            border: "1px solid var(--color-border)",
            color: "var(--color-foreground)",
          }}
        />
        <span className="text-sm text-muted">to</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="text-sm px-2 py-1 rounded border"
          style={{
            background: "var(--color-background)",
            border: "1px solid var(--color-border)",
            color: "var(--color-foreground)",
          }}
        />
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => setWeekOffset(-1)}
            className="text-xs px-3 py-1 rounded"
            style={{
              background: "var(--color-surface-hover)",
              border: "1px solid var(--color-border)",
            }}
          >
            ← Prev week
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="text-xs px-3 py-1 rounded font-medium"
            style={{
              background: isCurrentWeek
                ? "var(--color-primary)"
                : "var(--color-surface-hover)",
              color: isCurrentWeek ? "#fff" : undefined,
              border: "1px solid var(--color-border)",
            }}
          >
            This week
          </button>
          <button
            onClick={() => setWeekOffset(1)}
            className="text-xs px-3 py-1 rounded"
            style={{
              background: "var(--color-surface-hover)",
              border: "1px solid var(--color-border)",
            }}
          >
            Next week →
          </button>
        </div>
      </div>

      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-lg text-sm"
          style={{
            background: "var(--color-error-light)",
            color: "var(--color-error)",
            border: "1px solid var(--color-error-border)",
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted py-8 text-center">Loading...</div>
      ) : taskIds.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <p className="text-muted">No time entries for this period.</p>
          <p className="text-sm text-subtle mt-1">
            Time is recorded on individual tasks. Click a cell to add hours.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--color-border)" }}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: "var(--color-surface)" }}>
                <th
                  className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wide"
                  style={{
                    borderBottom: "1px solid var(--color-border)",
                    minWidth: 220,
                    position: "sticky",
                    left: 0,
                    background: "var(--color-surface)",
                    zIndex: 1,
                  }}
                >
                  Task
                </th>
                {dates.map((d) => (
                  <th
                    key={d}
                    className="text-center px-3 py-3 font-medium text-xs"
                    style={{
                      borderBottom: "1px solid var(--color-border)",
                      borderLeft: "1px solid var(--color-border)",
                      minWidth: 90,
                      color:
                        d === today
                          ? "var(--color-primary)"
                          : "var(--color-muted)",
                      fontWeight: d === today ? 700 : 500,
                    }}
                  >
                    {formatDate(d)}
                  </th>
                ))}
                <th
                  className="text-center px-3 py-3 font-semibold text-muted text-xs uppercase tracking-wide"
                  style={{
                    borderBottom: "1px solid var(--color-border)",
                    borderLeft: "1px solid var(--color-border)",
                    minWidth: 110,
                  }}
                >
                  Remaining
                </th>
                <th
                  className="text-center px-3 py-3 font-semibold text-muted text-xs uppercase tracking-wide"
                  style={{
                    borderBottom: "1px solid var(--color-border)",
                    borderLeft: "1px solid var(--color-border)",
                    minWidth: 70,
                  }}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {taskIds.map((taskId, i) => {
                const task = taskMap.get(taskId)!;
                const taskLogs = logMap.get(taskId)!;
                const rowTotal = Array.from(taskLogs.values()).reduce(
                  (s, l) => s + Number(l.hours),
                  0,
                );
                const isStoryDone = task.user_story?.status === "done";
                const isEditingRem = editingRemaining === taskId;

                return (
                  <tr
                    key={taskId}
                    style={{
                      background:
                        i % 2 === 0
                          ? "var(--color-background)"
                          : "var(--color-surface)",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    {/* Task cell */}
                    <td
                      className="px-4 py-3"
                      style={{
                        position: "sticky",
                        left: 0,
                        background:
                          i % 2 === 0
                            ? "var(--color-background)"
                            : "var(--color-surface)",
                        zIndex: 1,
                        borderRight: "1px solid var(--color-border)",
                      }}
                    >
                      <div className="font-medium leading-snug">{task.title}</div>
                      {task.user_story && (
                        <div className="text-xs text-muted mt-0.5 truncate max-w-[200px]">
                          {task.user_story.title}
                          {isStoryDone && (
                            <span
                              className="ml-1 px-1 py-0.5 rounded text-[10px]"
                              style={{
                                background: "var(--color-surface-hover)",
                                color: "var(--color-muted)",
                              }}
                            >
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

                      return (
                        <td
                          key={d}
                          className="text-center px-2 py-2"
                          style={{
                            borderLeft: "1px solid var(--color-border)",
                            cursor: isStoryDone || isFuture ? "not-allowed" : "pointer",
                            background:
                              d === today
                                ? "var(--color-primary-light, rgba(99,102,241,0.05))"
                                : undefined,
                          }}
                          onClick={() => {
                            if (!isStoryDone && !isFuture) startEditCell(taskId, d);
                          }}
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
                                className="w-16 text-center text-sm px-1 py-0.5 rounded"
                                style={{
                                  background: "var(--color-background)",
                                  border: "1px solid var(--color-primary)",
                                  color: "var(--color-foreground)",
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              {cellError && (
                                <div
                                  className="text-[10px] mt-1"
                                  style={{ color: "var(--color-error)" }}
                                >
                                  {cellError}
                                </div>
                              )}
                            </div>
                          ) : log ? (
                            <span
                              className="font-medium"
                              style={{ color: "var(--color-foreground)" }}
                            >
                              {Number(log.hours).toFixed(2)}h
                            </span>
                          ) : (
                            <span
                              className="text-xs"
                              style={{ color: "var(--color-subtle)" }}
                            >
                              {isFuture ? "—" : "+"}
                            </span>
                          )}
                        </td>
                      );
                    })}

                    {/* Remaining time cell */}
                    <td
                      className="text-center px-2 py-2"
                      style={{
                        borderLeft: "1px solid var(--color-border)",
                        cursor: isStoryDone ? "not-allowed" : "pointer",
                      }}
                      onClick={() => {
                        if (!isStoryDone) startEditRemaining(taskId);
                      }}
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
                            onKeyDown={(e) => handleRemainingKeyDown(e, taskId)}
                            onBlur={() => {
                              if (remainingValue !== "") saveRemaining(taskId, remainingValue);
                              else setEditingRemaining(null);
                            }}
                            className="w-16 text-center text-sm px-1 py-0.5 rounded"
                            style={{
                              background: "var(--color-background)",
                              border: "1px solid var(--color-primary)",
                              color: "var(--color-foreground)",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          {remainingError && (
                            <div
                              className="text-[10px] mt-1"
                              style={{ color: "var(--color-error)" }}
                            >
                              {remainingError}
                            </div>
                          )}
                        </div>
                      ) : task.remaining_time != null ? (
                        <span className="font-medium">
                          {Number(task.remaining_time).toFixed(2)}h
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--color-subtle)" }}>
                          —
                        </span>
                      )}
                    </td>

                    {/* Row total */}
                    <td
                      className="text-center px-3 py-2 font-semibold text-xs"
                      style={{ borderLeft: "1px solid var(--color-border)" }}
                    >
                      {rowTotal > 0 ? `${rowTotal.toFixed(2)}h` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted mt-3">
        Click any cell to edit hours. Press Enter to save, Escape to cancel.
        Editing is blocked for completed stories.
      </p>
    </div>
  );
}
