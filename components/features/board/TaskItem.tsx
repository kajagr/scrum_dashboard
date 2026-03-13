"use client";

import { useState, useEffect } from "react";
import type { Task } from "@/lib/types";

interface TaskWithAssignee extends Task {
  assignee?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

interface TaskItemProps {
  task: TaskWithAssignee;
  currentUserId: string | null;
  canAccept: boolean;
  isUpdating: boolean;
  containerStyle: React.CSSProperties;
  onAccept: (taskId: string) => void;
  onResign: (taskId: string) => void;
  onUpdateStatus: (taskId: string, status: string) => void;
  onRefresh: () => void;
}

function useElapsedTime(activeSince: string | null, isActive: boolean) {
  const [elapsed, setElapsed] = useState(() => {
    if (!isActive || !activeSince) return 0;
    return Math.floor((Date.now() - new Date(activeSince).getTime()) / 1000);
  });

  useEffect(() => {
    if (!isActive || !activeSince) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(activeSince).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, activeSince]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return `${h > 0 ? `${h}h ` : ""}${m}m ${s}s`;
}

export default function TaskItem({
  task,
  currentUserId,
  canAccept,
  isUpdating,
  containerStyle,
  onAccept,
  onResign,
  onUpdateStatus,
  onRefresh,
}: TaskItemProps) {
  const [actionLoading, setActionLoading] = useState(false);

  const isMyTask = task.assignee_id === currentUserId && task.is_accepted;
  const isProposedToMe = task.assignee_id === currentUserId && !task.is_accepted;
  const isUnassigned = !task.assignee_id && !task.is_accepted;
  const isActive = task.is_active && isMyTask;

  const elapsed = useElapsedTime(task.active_since ?? null, isActive);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/start`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Napaka pri začetku dela.");
      }
    } catch {
      alert("Napaka pri začetku dela.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/stop`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Napaka pri končanju dela.");
      }
    } catch {
      alert("Napaka pri končanju dela.");
    } finally {
      setActionLoading(false);
    }
  };

  const loading = isUpdating || actionLoading;

  return (
    <div
      className={`rounded-lg p-3 transition-opacity ${loading ? "opacity-50" : ""}`}
      style={containerStyle}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => onUpdateStatus(task.id, task.status === "completed" ? "assigned" : "completed")}
          disabled={loading || !isMyTask}
          className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors"
          style={
            task.status === "completed"
              ? { background: "#34D399", borderColor: "#34D399", color: "#ffffff" }
              : isMyTask
                ? { borderColor: "var(--color-border)", background: "transparent" }
                : { borderColor: "var(--color-border)", background: "transparent", opacity: 0.4, cursor: "not-allowed" }
          }
        >
          {task.status === "completed" && (
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium ${task.status === "completed" ? "line-through" : ""}`}
            style={{ color: task.status === "completed" ? "var(--color-muted)" : "var(--color-foreground)" }}
          >
            {task.description || task.title}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-[var(--color-muted)]">
            {/* Čas */}
            {task.estimated_hours && (
              <span>⏱️ {task.logged_hours ?? 0}h / {task.estimated_hours}h</span>
            )}

            {/* Tekoči čas */}
            {isActive && (
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 font-mono font-medium"
                style={{
                  background: "var(--color-accent-light)",
                  color: "var(--color-accent-text)",
                  border: "1px solid var(--color-accent-border)",
                }}
              >
                🔴 {elapsed}
              </span>
            )}

            {/* Assignee */}
            {task.assignee ? (
              <span className="flex items-center gap-1">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium"
                  style={{
                    background: "var(--color-primary-light)",
                    color: "var(--color-primary)",
                    border: "1px solid var(--color-primary-border)",
                  }}
                >
                  {task.assignee.first_name?.[0]}{task.assignee.last_name?.[0]}
                </span>
                {task.assignee.first_name} {task.assignee.last_name}
                {!task.is_accepted && (
                  <span style={{ color: "#F59E0B", fontSize: "10px" }}>(predlagano)</span>
                )}
              </span>
            ) : (
              <span className="flex items-center gap-1" style={{ color: "var(--color-subtle)" }}>
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                >
                  <svg className="h-3 w-3" style={{ color: "var(--color-subtle)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                Unassigned
              </span>
            )}
          </div>

          {/* Akcijski gumbi — v drugi vrstici */}
          {task.status !== "completed" && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {/* Sprejmi */}
              {canAccept && !task.is_accepted && (isUnassigned || isProposedToMe) && (
                <button
                  onClick={() => onAccept(task.id)}
                  disabled={loading}
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium transition hover:opacity-90"
                  style={{
                    background: "color-mix(in srgb, #34D399 15%, transparent)",
                    color: "#34D399",
                    border: "1px solid color-mix(in srgb, #34D399 30%, transparent)",
                  }}
                >
                  ✓ Sprejmi
                </button>
              )}

              {/* Začni delo */}
              {isMyTask && task.status === "assigned" && (
                <button
                  onClick={handleStart}
                  disabled={loading}
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium transition hover:opacity-90"
                  style={{
                    background: "var(--color-accent-light)",
                    color: "var(--color-accent-text)",
                    border: "1px solid var(--color-accent-border)",
                  }}
                >
                  ▶ Začni delo
                </button>
              )}

              {/* Končaj delo */}
              {isActive && (
                <button
                  onClick={handleStop}
                  disabled={loading}
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium transition hover:opacity-90"
                  style={{
                    background: "color-mix(in srgb, #F59E0B 15%, transparent)",
                    color: "#F59E0B",
                    border: "1px solid color-mix(in srgb, #F59E0B 30%, transparent)",
                  }}
                >
                  ⏹ Končaj delo
                </button>
              )}

              {/* Odpovej — samo kot majhen link */}
              {isMyTask && !isActive && (
                <button
                  onClick={() => onResign(task.id)}
                  disabled={loading}
                  className="text-xs transition hover:underline"
                  style={{ color: "var(--color-subtle)" }}
                >
                  Odpovej se
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}