"use client";

import { useState, useEffect } from "react";
import type { Task } from "@/lib/types";

export interface TaskWithAssignee extends Task {
  assignee?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

function useElapsedTime(activeSince: string | null, isActive: boolean) {
  const [elapsed, setElapsed] = useState(() => {
    if (!isActive || !activeSince) return 0;
    return Math.floor((Date.now() - new Date(activeSince).getTime()) / 1000);
  });

  useEffect(() => {
    if (!isActive || !activeSince) return;
    const interval = setInterval(() => {
      setElapsed(
        Math.floor((Date.now() - new Date(activeSince).getTime()) / 1000),
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, activeSince]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return `${h > 0 ? `${h}h ` : ""}${m}m ${s}s`;
}

interface TaskRowProps {
  task: TaskWithAssignee;
  currentUserId: string | null;
  canAccept: boolean;
  isUpdating: boolean;
  onAccept: (id: string) => void;
  onResign: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onRefresh: () => void;
  locked?: boolean;
}

export default function TaskRow({
  task,
  currentUserId,
  canAccept,
  isUpdating,
  onAccept,
  onResign,
  onUpdateStatus,
  onRefresh,
  locked = false,
}: TaskRowProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [resignConfirm, setResignConfirm] = useState(false);

  const isMyTask = task.assignee_id === currentUserId && task.is_accepted;
  const isProposedToMe =
    task.assignee_id === currentUserId && !task.is_accepted;
  const isUnassigned = !task.assignee_id && !task.is_accepted;
  const isActive = task.is_active && isMyTask;
  const isDone = task.status === "completed";
  const loading = isUpdating || actionLoading;

  const elapsed = useElapsedTime(task.active_since ?? null, isActive);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/start`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) onRefresh();
      else alert((await res.json()).error || "Napaka pri začetku dela.");
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
      if (res.ok) onRefresh();
      else alert((await res.json()).error || "Napaka pri končanju dela.");
    } catch {
      alert("Napaka pri končanju dela.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div
      className={`group flex items-start gap-3 p-3 rounded-xl border transition-all
        ${loading ? "opacity-50" : ""}
        ${
          isDone
            ? "bg-background border-border"
            : isMyTask
              ? "bg-primary-light border-primary-border"
              : "bg-background border-border hover:border-subtle"
        }`}
    >
      {/* Checkbox */}
      <button
        onClick={() =>
          onUpdateStatus(task.id, isDone ? "assigned" : "completed")
        }
        disabled={loading || !isMyTask || locked}
        className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
          ${
            isDone
              ? "bg-[#34D399] border-[#34D399] text-white"
              : isMyTask && !locked
                ? "border-primary hover:border-[#34D399]"
                : "border-subtle opacity-40 cursor-not-allowed"
          }`}
      >
        {isDone && (
          <svg
            className="w-2.5 h-2.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium leading-snug ${isDone ? "text-muted line-through" : "text-foreground"}`}
        >
          {task.description || task.title}
        </p>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {task.estimated_hours != null && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" d="M12 7v5l3 3" />
              </svg>
              {task.logged_hours ?? 0}h / {task.estimated_hours}h
            </span>
          )}
          {isActive && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-accent-light text-accent-text border border-accent-border">
              🔴 {elapsed}
            </span>
          )}
          {task.assignee ? (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className="w-5 h-5 rounded-full bg-primary-light text-primary border border-primary-border flex items-center justify-center text-[9px] font-bold">
                {task.assignee.first_name?.[0]}
                {task.assignee.last_name?.[0]}
              </span>
              {task.assignee.first_name} {task.assignee.last_name}
              {!task.is_accepted && (
                <span className="text-[10px] text-accent-text font-medium">
                  (proposed)
                </span>
              )}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className="w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center">
                <svg
                  className="w-3 h-3 text-subtle"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </span>
              Unassigned
            </span>
          )}
        </div>
      </div>

      {/* Action buttons — skrite ko je locked */}
      {!locked && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {canAccept &&
            !task.is_accepted &&
            (isUnassigned || isProposedToMe) &&
            !isDone && (
              <button
                onClick={() => onAccept(task.id)}
                disabled={loading}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors bg-[rgba(52,211,153,0.12)] text-[#34D399] border border-[rgba(52,211,153,0.25)] hover:bg-[rgba(52,211,153,0.2)] disabled:opacity-50"
              >
                Accept
              </button>
            )}
          {isMyTask && task.status === "assigned" && (
            <button
              onClick={handleStart}
              disabled={loading}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors bg-accent-light text-accent-text border border-accent-border hover:bg-accent/20 disabled:opacity-50"
            >
              ▶ Start
            </button>
          )}
          {isActive && (
            <button
              onClick={handleStop}
              disabled={loading}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors bg-background text-muted border border-border hover:border-subtle hover:text-foreground disabled:opacity-50"
            >
              ⏹ Stop
            </button>
          )}
          {isMyTask &&
            !isDone &&
            (resignConfirm ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setResignConfirm(false);
                    onResign(task.id);
                  }}
                  disabled={loading}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors bg-error-light text-error border border-error-border hover:bg-error/20 disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setResignConfirm(false)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors bg-background text-muted border border-border hover:border-subtle"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setResignConfirm(true)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors bg-background text-muted border border-border hover:border-error-border hover:text-error"
              >
                Resign
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
