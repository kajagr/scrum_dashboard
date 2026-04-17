"use client";

import { useState, useEffect } from "react";
import type { TaskWithAssignee } from "./TaskRow";

interface TaskTimeLogModalProps {
  task: TaskWithAssignee;
  onClose: () => void;
  onRefresh: () => void;
}

type TimeLog = {
  id: string;
  task_id: string;
  hours: number;
  date: string;
  logged_at: string;
  remaining_time: number | null;
};

type EditState = {
  id: string;
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

export default function TaskTimeLogModal({ task, onClose, onRefresh }: TaskTimeLogModalProps) {
  const today = new Date().toISOString().split("T")[0];

  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New log form
  const [newDate, setNewDate] = useState(today);
  const [newHours, setNewHours] = useState("");
  const [newRemaining, setNewRemaining] = useState(
    task.remaining_time != null ? String(task.remaining_time) : ""
  );
  const [newSaving, setNewSaving] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState<EditState | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/timelogs`, { credentials: "include" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Error loading time logs.");
        return;
      }
      setLogs(await res.json());
    } catch {
      setError("Server error.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [task.id]);

  const handleAddLog = async () => {
    const hours = Number(newHours);
    const remaining = Number(newRemaining);
    if (!newHours || isNaN(hours) || hours <= 0) {
      setNewError("Hours must be > 0.");
      return;
    }
    if (newRemaining === "" || isNaN(remaining) || remaining < 0) {
      setNewError("Remaining must be ≥ 0.");
      return;
    }
    setNewSaving(true);
    setNewError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/timelogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ date: newDate, hours_spent: hours, remaining_time: remaining }),
      });
      const d = await res.json();
      if (!res.ok) { setNewError(d.error ?? "Error logging time."); return; }
      setNewHours("");
      setNewRemaining(String(remaining));
      await fetchLogs();
      onRefresh();
    } catch {
      setNewError("Server error.");
    } finally {
      setNewSaving(false);
    }
  };

  const handleEditLog = async () => {
    if (!editing) return;
    const hours = Number(editing.hours);
    const remaining = Number(editing.remaining);
    if (!editing.hours || isNaN(hours) || hours <= 0) {
      setEditing((e) => e && { ...e, error: "Hours must be > 0." });
      return;
    }
    if (editing.remaining === "" || isNaN(remaining) || remaining < 0) {
      setEditing((e) => e && { ...e, error: "Remaining must be ≥ 0." });
      return;
    }
    setEditing((e) => e && { ...e, saving: true, error: null });
    try {
      const res = await fetch(`/api/timelogs/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ hours_spent: hours, remaining_time: remaining }),
      });
      const d = await res.json();
      if (!res.ok) {
        setEditing((e) => e && { ...e, saving: false, error: d.error ?? "Error updating." });
        return;
      }
      setEditing(null);
      await fetchLogs();
      onRefresh();
    } catch {
      setEditing((e) => e && { ...e, saving: false, error: "Server error." });
    }
  };

  const totalLogged = logs.reduce((s, l) => s + Number(l.hours), 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 backdrop-blur-sm bg-foreground/20" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden shadow-2xl bg-surface border border-border max-h-[85vh] flex flex-col">
        <div className="h-1 w-full bg-gradient-to-r from-primary to-accent flex-shrink-0" />

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-0.5">Time Log</p>
              <h2 className="text-lg font-bold text-foreground leading-snug">{task.description || task.title}</h2>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-xs text-muted flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 7v5l3 3" />
                  </svg>
                  {task.logged_hours ?? 0}h / {task.estimated_hours ?? "?"}h logged
                </span>
                <span className="text-xs text-muted">·</span>
                <span className="text-xs text-muted">{totalLogged.toFixed(1)}h this period</span>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-lg leading-none bg-background hover:bg-border text-muted transition-colors flex-shrink-0">×</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Add new log */}
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">Log time</p>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">Date</label>
                <input
                  type="date"
                  value={newDate}
                  max={today}
                  onChange={(e) => { setNewDate(e.target.value); setNewError(null); }}
                  className="px-3 py-2 rounded-lg text-sm bg-surface border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">Hours</label>
                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={newHours}
                  onChange={(e) => { setNewHours(e.target.value); setNewError(null); }}
                  placeholder="e.g. 2"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddLog(); }}
                  className="w-24 px-3 py-2 rounded-lg text-sm bg-surface border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-muted">Remaining</label>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={newRemaining}
                  onChange={(e) => { setNewRemaining(e.target.value); setNewError(null); }}
                  placeholder="e.g. 3"
                  className="w-24 px-3 py-2 rounded-lg text-sm bg-surface border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-muted opacity-0">Save</label>
                <button
                  onClick={handleAddLog}
                  disabled={newSaving}
                  className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {newSaving ? "..." : "+ Add"}
                </button>
              </div>
            </div>
            {newRemaining === "0" && (
              <p className="text-xs text-[#34D399] mt-2 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Remaining = 0 will auto-complete this task.
              </p>
            )}
            {newError && <p className="text-xs text-error mt-1.5">{newError}</p>}
          </div>

          {/* History */}
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">
              History{" "}
              {logs.length > 0 && (
                <span className="normal-case font-normal tracking-normal text-muted">
                  ({logs.length} entries · {totalLogged.toFixed(1)}h total)
                </span>
              )}
            </p>

            {loading ? (
              <div className="flex items-center gap-2 py-6 justify-center text-muted">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span className="text-sm">Loading...</span>
              </div>
            ) : error ? (
              <p className="text-sm text-error">{error}</p>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No time logged yet.</p>
            ) : (
              <table className="w-full text-xs border-collapse rounded-xl overflow-hidden border border-border">
                <thead>
                  <tr className="bg-background border-b border-border">
                    <th className="text-left px-3 py-2 font-semibold text-muted uppercase tracking-wide">Date</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted uppercase tracking-wide">Time</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted uppercase tracking-wide">Remaining</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) =>
                    editing?.id === log.id ? (
                      <tr key={log.id} className="border-b border-border last:border-0 bg-primary-light">
                        <td className="px-3 py-2 text-muted">{formatDateShort(log.date)}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            autoFocus
                            type="number"
                            min="0.25"
                            step="0.25"
                            value={editing.hours}
                            onChange={(e) => setEditing((s) => s && { ...s, hours: e.target.value, error: null })}
                            className="w-20 px-2 py-1 rounded-lg text-xs bg-surface border border-primary text-foreground focus:outline-none text-right"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.25"
                            value={editing.remaining}
                            onChange={(e) => setEditing((s) => s && { ...s, remaining: e.target.value, error: null })}
                            onKeyDown={(e) => { if (e.key === "Enter") handleEditLog(); if (e.key === "Escape") setEditing(null); }}
                            className="w-20 px-2 py-1 rounded-lg text-xs bg-surface border border-primary text-foreground focus:outline-none text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={handleEditLog}
                              disabled={editing.saving}
                              className="px-2 py-0.5 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
                            >
                              {editing.saving ? "..." : "Save"}
                            </button>
                            <button
                              onClick={() => setEditing(null)}
                              className="px-2 py-0.5 text-xs font-medium rounded-lg bg-background border border-border text-muted hover:text-foreground"
                            >
                              ×
                            </button>
                          </div>
                          {editing.error && <p className="text-xs text-error mt-1 text-right">{editing.error}</p>}
                        </td>
                      </tr>
                    ) : (
                      <tr
                        key={log.id}
                        className="border-b border-border last:border-0 hover:bg-background/60 cursor-pointer transition-colors"
                        onClick={() => setEditing({ id: log.id, hours: String(log.hours), remaining: log.remaining_time != null ? String(log.remaining_time) : "", error: null, saving: false })}
                      >
                        <td className="px-3 py-2.5 text-foreground">{formatDateShort(log.date)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-primary">{Number(log.hours).toFixed(1)}h</td>
                        <td className="px-3 py-2.5 text-right">
                          {log.remaining_time != null ? (
                            <span className={`font-semibold ${log.remaining_time === 0 ? "text-[#34D399]" : "text-foreground"}`}>
                              {Number(log.remaining_time).toFixed(1)}h
                            </span>
                          ) : (
                            <span className="text-subtle">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <svg className="w-3.5 h-3.5 text-muted inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                          </svg>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex-shrink-0">
          <button onClick={onClose} className="w-full px-4 py-2.5 text-sm font-medium rounded-xl transition-colors bg-background hover:bg-border text-muted">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
