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
};

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function TaskTimeLogModal({ task, onClose, onRefresh }: TaskTimeLogModalProps) {
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New entry
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newHours, setNewHours] = useState("");
  const [newLoading, setNewLoading] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);

  // Remaining
  const [remainingInput, setRemainingInput] = useState(
    task.remaining_time != null ? String(task.remaining_time) : ""
  );
  const [remainingLoading, setRemainingLoading] = useState(false);
  const [remainingError, setRemainingError] = useState<string | null>(null);
  const [remainingSaved, setRemainingSaved] = useState(false);

  // Editing existing log
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

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
    if (!newHours || isNaN(hours) || hours <= 0) {
      setNewError("Hours must be a positive number.");
      return;
    }
    setNewLoading(true);
    setNewError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/timelogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ date: newDate, hours_spent: hours }),
      });
      const d = await res.json();
      if (!res.ok) { setNewError(d.error ?? "Error logging time."); return; }
      setNewHours("");
      await fetchLogs();
      onRefresh();
    } catch {
      setNewError("Server error.");
    } finally {
      setNewLoading(false);
    }
  };

  const handleEditLog = async (logId: string) => {
    const hours = Number(editValue);
    if (!editValue || isNaN(hours) || hours <= 0) {
      setEditError("Must be a positive number.");
      return;
    }
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/timelogs/${logId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ hours_spent: hours }),
      });
      const d = await res.json();
      if (!res.ok) { setEditError(d.error ?? "Error updating."); return; }
      setEditingId(null);
      setEditValue("");
      await fetchLogs();
      onRefresh();
    } catch {
      setEditError("Server error.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleSaveRemaining = async () => {
    const hours = Number(remainingInput);
    if (remainingInput === "" || isNaN(hours) || hours < 0) {
      setRemainingError("Must be 0 or more.");
      return;
    }
    setRemainingLoading(true);
    setRemainingError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/remaining-time`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ remaining_time: hours }),
      });
      const d = await res.json();
      if (!res.ok) { setRemainingError(d.error ?? "Error updating."); return; }

      // Auto-complete when remaining = 0
      if (hours === 0) {
        await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status: "completed" }),
        });
      }

      setRemainingSaved(true);
      setTimeout(() => setRemainingSaved(false), 2000);
      onRefresh();
    } catch {
      setRemainingError("Server error.");
    } finally {
      setRemainingLoading(false);
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
                <span className="text-xs text-muted">
                  {totalLogged.toFixed(1)}h this period
                </span>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-lg leading-none bg-background hover:bg-border text-muted transition-colors flex-shrink-0">×</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Remaining time */}
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">Remaining time</p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                step="0.25"
                value={remainingInput}
                onChange={(e) => { setRemainingInput(e.target.value); setRemainingError(null); setRemainingSaved(false); }}
                placeholder="hours remaining"
                className="flex-1 px-3 py-2 rounded-lg text-sm bg-surface border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <button
                onClick={handleSaveRemaining}
                disabled={remainingLoading}
                className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {remainingLoading ? "..." : remainingSaved ? "✓ Saved" : "Save"}
              </button>
            </div>
            {remainingInput === "0" && !remainingSaved && (
              <p className="text-xs text-[#34D399] mt-2 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Saving 0h will automatically complete this task.
              </p>
            )}
            {remainingError && <p className="text-xs text-error mt-1">{remainingError}</p>}
          </div>

          {/* Add new log */}
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">Log hours</p>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={newDate}
                max={today}
                onChange={(e) => { setNewDate(e.target.value); setNewError(null); }}
                className="px-3 py-2 rounded-lg text-sm bg-surface border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <input
                type="number"
                min="0.01"
                step="0.25"
                value={newHours}
                onChange={(e) => { setNewHours(e.target.value); setNewError(null); }}
                placeholder="hours"
                onKeyDown={(e) => { if (e.key === "Enter") handleAddLog(); }}
                className="w-24 px-3 py-2 rounded-lg text-sm bg-surface border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <button
                onClick={handleAddLog}
                disabled={newLoading || !newHours}
                className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {newLoading ? "..." : "+ Add"}
              </button>
            </div>
            {newError && <p className="text-xs text-error mt-1.5">{newError}</p>}
          </div>

          {/* Existing logs */}
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">
              History {logs.length > 0 && <span className="normal-case font-normal tracking-normal text-muted">({logs.length} entries · {totalLogged.toFixed(1)}h total)</span>}
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
              <div className="flex items-start gap-2.5 p-3 rounded-xl border border-error-border bg-error-light">
                <svg className="w-4 h-4 text-error mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-sm text-error">{error}</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 rounded-xl border border-border bg-background text-center">
                <svg className="w-8 h-8 text-subtle mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                </svg>
                <p className="text-sm text-muted">No time logged yet.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-border bg-background"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <svg className="w-3.5 h-3.5 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm text-foreground">{formatDate(log.date)}</span>
                    </div>

                    {editingId === log.id ? (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <input
                          autoFocus
                          type="number"
                          min="0.01"
                          step="0.25"
                          value={editValue}
                          onChange={(e) => { setEditValue(e.target.value); setEditError(null); }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEditLog(log.id);
                            if (e.key === "Escape") { setEditingId(null); setEditError(null); }
                          }}
                          className="w-20 px-2 py-1 rounded-lg text-sm bg-surface border border-primary text-foreground focus:outline-none"
                        />
                        <button
                          onClick={() => handleEditLog(log.id)}
                          disabled={editLoading}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-colors"
                        >
                          {editLoading ? "..." : "Save"}
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditError(null); }}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-background border border-border text-muted hover:text-foreground transition-colors"
                        >
                          Cancel
                        </button>
                        {editError && <p className="text-xs text-error">{editError}</p>}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold text-foreground px-2 py-0.5 rounded-lg bg-primary-light text-primary border border-primary-border">
                          {Number(log.hours).toFixed(1)}h
                        </span>
                        <button
                          onClick={() => { setEditingId(log.id); setEditValue(String(log.hours)); setEditError(null); }}
                          className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors"
                          title="Edit"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 text-sm font-medium rounded-xl transition-colors bg-background hover:bg-border text-muted"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}